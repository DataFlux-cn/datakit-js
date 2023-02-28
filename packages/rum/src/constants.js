import { DefaultPrivacyLevel } from '@cloudcare/browser-core'
export var NodePrivacyLevel = {
  IGNORE: 'ignore',
  HIDDEN: 'hidden',
  ALLOW: DefaultPrivacyLevel.ALLOW,
  MASK: DefaultPrivacyLevel.MASK,
  MASK_USER_INPUT: DefaultPrivacyLevel.MASK_USER_INPUT
}

export var PRIVACY_ATTR_NAME = 'data-dd-privacy'

// Privacy Attrs
export var PRIVACY_ATTR_VALUE_ALLOW = 'allow'
export var PRIVACY_ATTR_VALUE_MASK = 'mask'
export var PRIVACY_ATTR_VALUE_MASK_USER_INPUT = 'mask-user-input'
export var PRIVACY_ATTR_VALUE_HIDDEN = 'hidden'

// Privacy Classes - not all customers can set plain HTML attributes, so support classes too
export var PRIVACY_CLASS_ALLOW = 'dd-privacy-allow'
export var PRIVACY_CLASS_MASK = 'dd-privacy-mask'
export var PRIVACY_CLASS_MASK_USER_INPUT = 'dd-privacy-mask-user-input'
export var PRIVACY_CLASS_HIDDEN = 'dd-privacy-hidden'

// Private Replacement Templates
export var CENSORED_STRING_MARK = '***'
export var CENSORED_IMG_MARK =
  'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='

export var FORM_PRIVATE_TAG_NAMES = {
  INPUT: true,
  OUTPUT: true,
  TEXTAREA: true,
  SELECT: true,
  OPTION: true,
  DATALIST: true,
  OPTGROUP: true
}
