import { arrayFrom, cssEscape, elementMatches,map} from '@cloudcare/browser-core'

/**
 * Stable attributes are attributes that are commonly used to identify parts of a UI (ex:
 * component). Those attribute values should not be generated randomly (hardcoded most of the time)
 * and stay the same across deploys. They are not necessarily unique across the document.
 */
var STABLE_ATTRIBUTES = [
  'data-guance-action-name',
  // Common test attributes (list provided by google recorder)
  'data-testid',
  'data-test',
  'data-qa',
  'data-cy',
  'data-test-id',
  'data-qa-id',
  'data-testing',
  // FullStory decorator attributes:
  'data-component',
  'data-element',
  'data-source-file',
]

export function getSelectorsFromElement(element, actionNameAttribute) {
  var attributeSelectors = getStableAttributeSelectors()
  if (actionNameAttribute) {
    attributeSelectors = [function(element){return getAttributeSelector(actionNameAttribute, element)}].concat(
      attributeSelectors
    )
  }
  return {
    selector: getSelectorFromElement(element, [getIDSelector], [getClassSelector]),
    selector_with_stable_attributes: getSelectorFromElement(
      element,
      attributeSelectors.concat(getIDSelector),
      attributeSelectors.concat(getClassSelector)
    ),
    selector_without_classes: getSelectorFromElement(
      element,
      attributeSelectors.concat(getIDSelector),
      attributeSelectors
    ),
  }
}

function getSelectorFromElement(
  targetElement,
  globallyUniqueSelectorStrategies,
  uniqueAmongChildrenSelectorStrategies
){
  var targetElementSelector = []
  var element = targetElement

  while (element && element.nodeName !== 'HTML') {
    var globallyUniqueSelector = findSelector(element, globallyUniqueSelectorStrategies, isSelectorUniqueGlobally)
    if (globallyUniqueSelector) {
      targetElementSelector.unshift(globallyUniqueSelector)
      break
    }

    var uniqueSelectorAmongChildren = findSelector(
      element,
      uniqueAmongChildrenSelectorStrategies,
      isSelectorUniqueAmongChildren
    )
    if (uniqueSelectorAmongChildren) {
      targetElementSelector.unshift(uniqueSelectorAmongChildren)
    } else {
      targetElementSelector.unshift(getPositionSelector(element))
    }

    element = element.parentElement
  }

  return targetElementSelector.join('>')
}

function getIDSelector(element) {
  if (element.id) {
    return '#' + cssEscape(element.id)
  }
}

function getClassSelector(element){
  if (element.classList.length > 0) {
    var orderedClassList = arrayFrom(element.classList).sort()
    return element.tagName + map(orderedClassList, function(className){return '.' + cssEscape(className)}).join('')
  }
}

var stableAttributeSelectorsCache
function getStableAttributeSelectors() {
  if (!stableAttributeSelectorsCache) {
    stableAttributeSelectorsCache = map(STABLE_ATTRIBUTES,
      function(attribute) { return function(element) { return getAttributeSelector(attribute, element) }}
    )
  }
  return stableAttributeSelectorsCache
}

function getAttributeSelector(attributeName, element) {
  if (element.hasAttribute(attributeName)) {
    return element.tagName + '[' + attributeName + '="' + cssEscape(element.getAttribute(attributeName))+'"]'
  }
}

function getPositionSelector(element) {
  var parent = element.parentElement
  var sibling = parent.firstElementChild
  var currentIndex = 0
  var elementIndex

  while (sibling) {
    if (sibling.tagName === element.tagName) {
      currentIndex += 1
      if (sibling === element) {
        elementIndex = currentIndex
      }

      if (elementIndex !== undefined && currentIndex > 1) {
        // Performance improvement: avoid iterating over all children, stop as soon as we are sure
        // the element is not alone
        break
      }
    }
    sibling = sibling.nextElementSibling
  }

  return currentIndex === 1 ? element.tagName : element.tagName + ':nth-of-type(' + elementIndex + ')'
}

function findSelector(
  element,
  selectorGetters,
  predicate
) {
  for (var selectorGetter of selectorGetters) {
    var selector = selectorGetter(element)
    if (selector && predicate(element, selector)) {
      return selector
    }
  }
}

function isSelectorUniqueGlobally(element, selector) {
  return element.ownerDocument.body.querySelectorAll(selector).length === 1
}

function isSelectorUniqueAmongChildren(element, selector) {
  for (var i = 0; i < element.parentElement.children.length; i++) {
    var sibling = element.parentElement.children[i]
    if (sibling !== element && elementMatches(sibling, selector)) {
      return false
    }
  }
  return true
}
