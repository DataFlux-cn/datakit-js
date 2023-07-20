import {
  getParentNode,
  isNodeShadowRoot,
  buildUrl
} from '@cloudcare/browser-core'
import { CENSORED_STRING_MARK } from '../../../constants'
import { shouldMaskNode } from './privacy'

var serializedNodeIds = new WeakMap()

export function hasSerializedNode(node) {
  return serializedNodeIds.has(node)
}

export function nodeAndAncestorsHaveSerializedNode(node) {
  var current = node
  while (current) {
    if (!hasSerializedNode(current) && !isNodeShadowRoot(current)) {
      return false
    }
    current = getParentNode(current)
  }
  return true
}

export function getSerializedNodeId(node) {
  return serializedNodeIds.get(node)
}

export function setSerializedNodeId(node, serializeNodeId) {
  serializedNodeIds.set(node, serializeNodeId)
}

/**
 * Get the element "value" to be serialized as an attribute or an input update record. It respects
 * the input privacy mode of the element.
 * PERFROMANCE OPTIMIZATION: Assumes that privacy level `HIDDEN` is never encountered because of earlier checks.
 */
export function getElementInputValue(element, nodePrivacyLevel) {
  /*
   BROWSER SPEC NOTE: <input>, <select>
   For some <input> elements, the `value` is an exceptional property/attribute that has the
   value synced between el.value and el.getAttribute()
   input[type=button,checkbox,hidden,image,radio,reset,submit]
   */
  var tagName = element.tagName
  var value = element.value

  if (shouldMaskNode(element, nodePrivacyLevel)) {
    var type = element.type
    if (
      tagName === 'INPUT' &&
      (type === 'button' || type === 'submit' || type === 'reset')
    ) {
      // Overrule `MASK` privacy level for button-like element values, as they are used during replay
      // to display their label. They can still be hidden via the "hidden" privacy attribute or class name.
      return value
    } else if (!value || tagName === 'OPTION') {
      // <Option> value provides no benefit
      return
    }
    return CENSORED_STRING_MARK
  }

  if (tagName === 'OPTION' || tagName === 'SELECT') {
    return element.value
  }

  if (tagName !== 'INPUT' && tagName !== 'TEXTAREA') {
    return
  }

  return value
}
function extractOrigin(url) {
  var origin = ''
  if (url.indexOf('//') > -1) {
    origin = url.split('/').slice(0, 3).join('/')
  } else {
    origin = url.split('/')[0]
  }
  origin = origin.split('?')[0]
  return origin
}
export var URL_IN_CSS_REF = /url\((?:(')([^']*)'|(")([^"]*)"|([^)]*))\)/gm
export var ABSOLUTE_URL = /^[A-Za-z]+:|^\/\//
export var DATA_URI = /^data:.*,/i

export function switchToAbsoluteUrl(cssText, cssHref) {
  return cssText.replace(
    URL_IN_CSS_REF,
    function (
      matchingSubstring,
      singleQuote,
      urlWrappedInSingleQuotes,
      doubleQuote,
      urlWrappedInDoubleQuotes,
      urlNotWrappedInQuotes
    ) {
      var url =
        urlWrappedInSingleQuotes ||
        urlWrappedInDoubleQuotes ||
        urlNotWrappedInQuotes

      if (!cssHref || !url || ABSOLUTE_URL.test(url) || DATA_URI.test(url)) {
        return matchingSubstring
      }
      var quote = singleQuote || doubleQuote || ''
      if (url[0] === '/') {
        return 'url('
          .concat(quote)
          .concat(extractOrigin(cssHref) + url)
          .concat(quote, ')')
      }
      return `url(${quote}${makeUrlAbsolute(url, cssHref)}${quote})`
    }
  )
}

export function makeUrlAbsolute(url, baseUrl) {
  try {
    return buildUrl(url, baseUrl).href
  } catch (_) {
    return url
  }
}
export function validateStringifiedCssRule(cssStringified) {
  // Safari does not escape selectors with : properly
  if (cssStringified.includes(':')) {
    // Replace e.g. [aa:bb] with [aa\\:bb]
    const regex = /(\[(?:[\w-]+)[^\\])(:(?:[\w-]+)\])/gm
    return cssStringified.replace(regex, '$1\\$2')
  }

  return cssStringified
}
export function serializeStyleSheets(cssStyleSheets) {
  if (cssStyleSheets === undefined || cssStyleSheets.length === 0) {
    return undefined
  }
  return cssStyleSheets.map(function (cssStyleSheet) {
    var rules = cssStyleSheet.cssRules || cssStyleSheet.rules
    var cssRules = Array.from(rules, function (cssRule) {
      return cssRule.cssText ? validateStringifiedCssRule(rule.cssText) : ''
    })

    var styleSheet = {
      cssRules: cssRules,
      disabled: cssStyleSheet.disabled || undefined,
      media:
        cssStyleSheet.media.length > 0
          ? Array.from(cssStyleSheet.media)
          : undefined
    }
    return styleSheet
  })
}
export function absoluteToDoc(doc, attributeValue) {
  if (!attributeValue || attributeValue.trim() === '') {
    return attributeValue
  }
  var a = doc.createElement('a')
  a.href = attributeValue
  return a.href
}

var SRCSET_NOT_SPACES = /^[^ \t\n\r\u000c]+/
var SRCSET_COMMAS_OR_SPACES = /^[, \t\n\r\u000c]+/
export function getAbsoluteSrcsetString(doc, attributeValue) {
  if (attributeValue.trim() === '') {
    return attributeValue
  }
  var pos = 0
  function collectCharacters(regEx) {
    var chars
    var match = regEx.exec(attributeValue.substring(pos))
    if (match) {
      chars = match[0]
      pos += chars.length
      return chars
    }
    return ''
  }
  var output = []
  while (true) {
    collectCharacters(SRCSET_COMMAS_OR_SPACES)
    if (pos >= attributeValue.length) {
      break
    }
    var url = collectCharacters(SRCSET_NOT_SPACES)
    if (url.slice(-1) === ',') {
      url = absoluteToDoc(doc, url.substring(0, url.length - 1))
      output.push(url)
    } else {
      var descriptorsStr = ''
      url = absoluteToDoc(doc, url)
      var inParens = false
      while (true) {
        var c = attributeValue.charAt(pos)
        if (c === '') {
          output.push((url + descriptorsStr).trim())
          break
        } else if (!inParens) {
          if (c === ',') {
            pos += 1
            output.push((url + descriptorsStr).trim())
            break
          } else if (c === '(') {
            inParens = true
          }
        } else {
          if (c === ')') {
            inParens = false
          }
        }
        descriptorsStr += c
        pos += 1
      }
    }
  }
  return output.join(', ')
}
