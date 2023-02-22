export function isTextNode(node) {
  return node.nodeType === node.TEXT_NODE
}

export function isCommentNode(node) {
  return node.nodeType === node.COMMENT_NODE
}

export function isElementNode(node) {
  return node.nodeType === node.ELEMENT_NODE
}

export function isNodeShadowHost(node) {
  return isElementNode(node) && Boolean(node.shadowRoot)
}

export function isNodeShadowRoot(node) {
  var shadowRoot = node
  return !!shadowRoot.host && isElementNode(shadowRoot.host)
}

export function getChildNodes(node) {
  return isNodeShadowHost(node) ? node.shadowRoot.childNodes : node.childNodes
}

/**
 * Return `host` in case if the current node is a shadow root otherwise will return the `parentNode`
 */
export function getParentNode(node) {
  return isNodeShadowRoot(node) ? node.host : node.parentNode
}
