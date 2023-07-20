import {
  assign,
  startsWith,
  isNodeShadowHost,
  isNodeShadowRoot
} from '@cloudcare/browser-core'
import { STABLE_ATTRIBUTES } from '../../rumEventsCollection/actions/getSelectorsFromElement'
import {
  NodePrivacyLevel,
  PRIVACY_ATTR_NAME,
  PRIVACY_ATTR_VALUE_HIDDEN,
  CENSORED_STRING_MARK,
  CENSORED_IMG_MARK
} from '../../../constants'

import { NodeType } from '../../../types'
import {
  getTextContent,
  shouldMaskNode,
  reducePrivacyLevel,
  getNodeSelfPrivacyLevel,
  MAX_ATTRIBUTE_VALUE_CHAR_LENGTH
} from './privacy'
import {
  getSerializedNodeId,
  setSerializedNodeId,
  getElementInputValue,
  switchToAbsoluteUrl,
  serializeStyleSheets,
  absoluteToDoc,
  getAbsoluteSrcsetString,
  validateStringifiedCssRule
} from './serializationUtils'

// Those values are the only one that can be used when inheriting privacy levels from parent to
// children during serialization, since HIDDEN and IGNORE shouldn't serialize their children. This
// ensures that no children are serialized when they shouldn't.

export var SerializationContextStatus = {
  INITIAL_FULL_SNAPSHOT: 0,
  SUBSEQUENT_FULL_SNAPSHOT: 1,
  MUTATION: 2
}

export function serializeDocument(
  document,
  configuration,
  serializationContext
) {
  // We are sure that Documents are never ignored, so this function never returns null
  return serializeNodeWithId(document, {
    serializationContext: serializationContext,
    parentNodePrivacyLevel: configuration.defaultPrivacyLevel,
    configuration: configuration
  })
}

export function serializeNodeWithId(node, options) {
  var serializedNode = serializeNode(node, options)
  if (!serializedNode) {
    return null
  }

  // Try to reuse the previous id
  var id = getSerializedNodeId(node) || generateNextId()
  var serializedNodeWithId = serializedNode
  serializedNodeWithId.id = id
  setSerializedNodeId(node, id)
  if (options.serializedNodeIds) {
    options.serializedNodeIds.add(id)
  }
  return serializedNodeWithId
}

function serializeNode(node, options) {
  switch (node.nodeType) {
    case node.DOCUMENT_NODE:
      return serializeDocumentNode(node, options)
    case node.DOCUMENT_FRAGMENT_NODE:
      return serializeDocumentFragmentNode(node, options)
    case node.DOCUMENT_TYPE_NODE:
      return serializeDocumentTypeNode(node)
    case node.ELEMENT_NODE:
      return serializeElementNode(node, options)
    case node.TEXT_NODE:
      return serializeTextNode(node, options)
    case node.CDATA_SECTION_NODE:
      return serializeCDataNode()
  }
}

export function serializeDocumentNode(document, options) {
  return {
    type: NodeType.Document,
    childNodes: serializeChildNodes(document, options),
    adoptedStyleSheets: serializeStyleSheets(document.adoptedStyleSheets)
  }
}

function serializeDocumentTypeNode(documentType) {
  return {
    type: NodeType.DocumentType,
    name: documentType.name,
    publicId: documentType.publicId,
    systemId: documentType.systemId
  }
}

function serializeDocumentFragmentNode(element, options) {
  var childNodes = []
  if (element.childNodes.length) {
    childNodes = serializeChildNodes(element, options)
  }

  var isShadowRoot = isNodeShadowRoot(element)
  if (isShadowRoot) {
    options.serializationContext.shadowRootsController.addShadowRoot(element)
  }

  return {
    type: NodeType.DocumentFragment,
    childNodes: childNodes,
    isShadowRoot: isShadowRoot,
    adoptedStyleSheets: isShadowRoot
      ? serializeStyleSheets(element.adoptedStyleSheets)
      : undefined
  }
}

/**
 * Serializing Element nodes involves capturing:
 * 1. HTML ATTRIBUTES:
 * 2. JS STATE:
 * - scroll offsets
 * - Form fields (input value, checkbox checked, option selection, range)
 * - Canvas state,
 * - Media (video/audio) play mode + currentTime
 * - iframe contents
 * - webcomponents
 * 3. CUSTOM PROPERTIES:
 * - height+width for when `hidden` to cover the element
 * 4. EXCLUDED INTERACTION STATE:
 * - focus (possible, but not worth perf impact)
 * - hover (tracked only via mouse activity)
 * - fullscreen mode
 */
export function serializeElementNode(element, options) {
  var tagName = getValidTagName(element.tagName)
  var isSVG = isSVGElement(element) || undefined

  // For performance reason, we don't use getNodePrivacyLevel directly: we leverage the
  // parentNodePrivacyLevel option to avoid iterating over all parents
  var nodePrivacyLevel = reducePrivacyLevel(
    getNodeSelfPrivacyLevel(element),
    options.parentNodePrivacyLevel
  )

  if (nodePrivacyLevel === NodePrivacyLevel.HIDDEN) {
    var _boundingClientRect = element.getBoundingClientRect()
    var width = _boundingClientRect.width
    var height = _boundingClientRect.height
    return {
      type: NodeType.Element,
      tagName: tagName,
      attributes: {
        rr_width: width + 'px',
        rr_height: height + 'px',
        [PRIVACY_ATTR_NAME]: PRIVACY_ATTR_VALUE_HIDDEN
      },
      childNodes: [],
      isSVG: isSVG
    }
  }

  // Ignore Elements like Script and some Link, Metas
  if (nodePrivacyLevel === NodePrivacyLevel.IGNORE) {
    return
  }

  var attributes = getAttributesForPrivacyLevel(
    element,
    nodePrivacyLevel,
    options
  )

  var childNodes = []
  if (element.childNodes.length) {
    // OBJECT POOLING OPTIMIZATION:
    // We should not create a new object systematically as it could impact performances. Try to reuse
    // the same object as much as possible, and clone it only if we need to.
    var childNodesSerializationOptions
    if (
      options.parentNodePrivacyLevel === nodePrivacyLevel &&
      options.ignoreWhiteSpace === (tagName === 'head')
    ) {
      childNodesSerializationOptions = options
    } else {
      childNodesSerializationOptions = assign({}, options, {
        parentNodePrivacyLevel: nodePrivacyLevel,
        ignoreWhiteSpace: tagName === 'head'
      })
    }
    childNodes = serializeChildNodes(element, childNodesSerializationOptions)
  }

  if (isNodeShadowHost(element)) {
    var shadowRoot = serializeNodeWithId(element.shadowRoot, options)
    if (shadowRoot !== null) {
      childNodes.push(shadowRoot)
    }
  }

  return {
    type: NodeType.Element,
    tagName: tagName,
    attributes: attributes,
    childNodes: childNodes,
    isSVG: isSVG
  }
}

/**
 * Text Nodes are dependant on Element nodes
 * Privacy levels are set on elements so we check the parentElement of a text node
 * for privacy level.
 */
function serializeTextNode(textNode, options) {
  // The parent node may not be a html element which has a tagName attribute.
  // So just let it be undefined which is ok in this use case.
  var parentTagName = textNode.parentElement && textNode.parentElement.tagName
  var textContent = getTextContent(
    textNode,
    options.ignoreWhiteSpace || false,
    options.parentNodePrivacyLevel
  )
  if (!textContent) {
    return
  }
  return {
    type: NodeType.Text,
    textContent: textContent,
    isStyle: parentTagName === 'STYLE' ? true : undefined
  }
}

function serializeCDataNode() {
  return {
    type: NodeType.CDATA,
    textContent: ''
  }
}

export function serializeChildNodes(node, options) {
  var result = []
  node.childNodes.forEach(function (childNode) {
    var serializedChildNode = serializeNodeWithId(childNode, options)
    if (serializedChildNode) {
      result.push(serializedChildNode)
    }
  })
  return result
}

export function serializeAttribute(
  element,
  nodePrivacyLevel,
  attributeName,
  configuration
) {
  if (nodePrivacyLevel === NodePrivacyLevel.HIDDEN) {
    // dup condition for direct access case
    return null
  }
  var attributeValue = element.getAttribute(attributeName)
  if (
    nodePrivacyLevel === NodePrivacyLevel.MASK &&
    attributeName !== PRIVACY_ATTR_NAME &&
    !STABLE_ATTRIBUTES.includes(attributeName) &&
    attributeName !== configuration.actionNameAttribute
  ) {
    var tagName = element.tagName

    switch (attributeName) {
      // Mask Attribute text content
      case 'title':
      case 'alt':
      case 'placeholder':
        return CENSORED_STRING_MARK
    }
    // mask image URLs
    if (tagName === 'IMG' || tagName === 'SOURCE') {
      if (attributeName === 'src' || attributeName === 'srcset') {
        return CENSORED_IMG_MARK
      }
    }
    // mask <a> URLs
    if (tagName === 'A' && attributeName === 'href') {
      return CENSORED_STRING_MARK
    }

    // mask data-* attributes
    if (attributeValue && startsWith(attributeName, 'data-')) {
      // Exception: it's safe to reveal the `${PRIVACY_ATTR_NAME}` attr
      return CENSORED_STRING_MARK
    }
  }

  if (!attributeValue || typeof attributeValue !== 'string') {
    return attributeValue
  }

  // Minimum Fix for customer.
  if (
    attributeValue.length > MAX_ATTRIBUTE_VALUE_CHAR_LENGTH &&
    attributeValue.slice(0, 5) === 'data:'
  ) {
    return 'data:truncated'
  }

  return attributeValue
}

var _nextId = 1
function generateNextId() {
  return _nextId++
}

var TAG_NAME_REGEX = /[^a-z1-6-_]/
function getValidTagName(tagName) {
  var processedTagName = tagName.toLowerCase().trim()

  if (TAG_NAME_REGEX.test(processedTagName)) {
    // if the tag name is odd and we cannot extract
    // anything from the string, then we return a
    // generic div
    return 'div'
  }

  return processedTagName
}
/**
 * Browsers sometimes destructively modify the css rules they receive.
 * This function tries to rectify the modifications the browser made to make it more cross platform compatible.
 * @param cssText - output of `CSSStyleRule.cssText`
 * @returns `cssText` with browser inconsistencies fixed.
 */
function fixBrowserCompatibilityIssuesInCSS(cssText) {
  /**
   * Chrome outputs `-webkit-background-clip` as `background-clip` in `CSSStyleRule.cssText`.
   * But then Chrome ignores `background-clip` as css input.
   * Re-introduce `-webkit-background-clip` to fix this issue.
   */
  if (
    cssText.includes(' background-clip: text;') &&
    !cssText.includes(' -webkit-background-clip: text;')
  ) {
    cssText = cssText.replace(
      ' background-clip: text;',
      ' -webkit-background-clip: text; background-clip: text;'
    )
  }
  return cssText
}

function getCssRulesString(cssStyleSheet) {
  if (!cssStyleSheet) {
    return null
  }
  var rules
  try {
    rules = cssStyleSheet.rules || cssStyleSheet.cssRules
  } catch {
    // if css is protected by CORS we cannot access cssRules see: https://www.w3.org/TR/cssom-1/#the-cssstylesheet-interface
  }
  if (!rules) {
    return null
  }
  var styleSheetCssText = fixBrowserCompatibilityIssuesInCSS(
    Array.from(rules, getCssRuleString).join('')
  )
  return switchToAbsoluteUrl(styleSheetCssText, cssStyleSheet.href)
}

function getCssRuleString(rule) {
  var cssStringified = rule.cssText
  if (isCSSImportRule(rule)) {
    try {
      cssStringified = getCssRulesString(rule.styleSheet) || cssStringified
    } catch {
      // ignore
    }
  }
  return validateStringifiedCssRule(cssStringified)
}

function isCSSImportRule(rule) {
  return 'styleSheet' in rule
}

function isSVGElement(el) {
  return el.tagName === 'svg' || el instanceof SVGElement
}
function transformAttribute(doc, tagName, name, value) {
  if (!value) return value
  if (
    name === 'src' ||
    (name === 'href' && !(tagName === 'use' && value[0] === '#'))
  ) {
    return absoluteToDoc(doc, value)
  } else if (name === 'xlink:href' && value[0] !== '#') {
    return absoluteToDoc(doc, value)
  } else if (
    name === 'background' &&
    value &&
    (tagName === 'table' || tagName === 'td' || tagName === 'th')
  ) {
    return absoluteToDoc(doc, value)
  } else if (name === 'srcset') {
    return getAbsoluteSrcsetString(doc, value)
  } else if (name === 'style') {
    return switchToAbsoluteUrl(value, getHref())
  } else if (tagName === 'object' && name === 'data') {
    return absoluteToDoc(doc, value)
  } else {
    return value
  }
}
function getHref() {
  var a = document.createElement('a')
  a.href = ''
  return a.href
}
function getAttributesForPrivacyLevel(element, nodePrivacyLevel, options) {
  if (nodePrivacyLevel === NodePrivacyLevel.HIDDEN) {
    return {}
  }
  var safeAttrs = {}
  var tagName = getValidTagName(element.tagName)
  var doc = element.ownerDocument

  for (var i = 0; i < element.attributes.length; i += 1) {
    var attribute = element.attributes.item(i)
    var attributeName = attribute.name
    var attributeValue = serializeAttribute(
      element,
      nodePrivacyLevel,
      attributeName,
      options.configuration
    )
    if (attributeValue !== null) {
      safeAttrs[attributeName] = transformAttribute(
        doc,
        tagName,
        attributeName,
        attributeValue
      )
    }
  }

  if (
    element.value &&
    (tagName === 'textarea' ||
      tagName === 'select' ||
      tagName === 'option' ||
      tagName === 'input')
  ) {
    var formValue = getElementInputValue(element, nodePrivacyLevel)
    if (formValue !== undefined) {
      safeAttrs.value = formValue
    }
  }

  /**
   * <Option> can be selected, which occurs if its `value` matches ancestor `<Select>.value`
   */
  if (tagName === 'option' && nodePrivacyLevel === NodePrivacyLevel.ALLOW) {
    // For privacy=`MASK`, all the values would be the same, so skip.
    var optionElement = element
    if (optionElement.selected) {
      safeAttrs.selected = optionElement.selected
    }
  }

  // remote css
  if (tagName === 'link') {
    var stylesheet = Array.from(doc.styleSheets).find(function (s) {
      return s.href === element.href
    })
    var cssText = getCssRulesString(stylesheet)

    if (cssText && stylesheet) {
      safeAttrs._cssText = cssText
    }
  }

  // dynamic stylesheet
  if (
    tagName === 'style' &&
    element.sheet &&
    // TODO: Currently we only try to get dynamic stylesheet when it is an empty style element
    !(element.innerText || element.textContent || '').trim().length
  ) {
    var cssText = getCssRulesString(element.sheet)
    if (cssText) {
      safeAttrs._cssText = cssText
    }
  }

  /**
   * Forms: input[type=checkbox,radio]
   * The `checked` property for <input> is a little bit special:
   * 1. el.checked is a setter that returns if truthy.
   * 2. getAttribute returns the string value
   * getAttribute('checked') does not sync with `Element.checked`, so use JS property
   * NOTE: `checked` property exists on `HTMLInputElement`. For serializer assumptions, we check for type=radio|check.
   */
  var inputElement = element
  if (
    tagName === 'input' &&
    (inputElement.type === 'radio' || inputElement.type === 'checkbox')
  ) {
    if (nodePrivacyLevel === NodePrivacyLevel.ALLOW) {
      safeAttrs.checked = !!inputElement.checked
    } else if (shouldMaskNode(inputElement, nodePrivacyLevel)) {
      delete safeAttrs.checked
    }
  }

  /**
   * Serialize the media playback state
   */
  if (tagName === 'audio' || tagName === 'video') {
    var mediaElement = element
    safeAttrs.rr_mediaState = mediaElement.paused ? 'paused' : 'played'
  }

  /**
   * Serialize the scroll state for each element only for full snapshot
   */
  var scrollTop
  var scrollLeft
  var serializationContext = options.serializationContext
  switch (serializationContext.status) {
    case SerializationContextStatus.INITIAL_FULL_SNAPSHOT:
      scrollTop = Math.round(element.scrollTop)
      scrollLeft = Math.round(element.scrollLeft)
      if (scrollTop || scrollLeft) {
        serializationContext.elementsScrollPositions.set(element, {
          scrollTop: scrollTop,
          scrollLeft: scrollLeft
        })
      }
      break
    case SerializationContextStatus.SUBSEQUENT_FULL_SNAPSHOT:
      if (serializationContext.elementsScrollPositions.has(element)) {
        ;({ scrollTop, scrollLeft } =
          serializationContext.elementsScrollPositions.get(element))
      }
      break
  }
  if (scrollLeft) {
    safeAttrs.rr_scrollLeft = scrollLeft
  }
  if (scrollTop) {
    safeAttrs.rr_scrollTop = scrollTop
  }

  return safeAttrs
}
