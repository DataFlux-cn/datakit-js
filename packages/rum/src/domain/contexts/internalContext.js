/**
 * Internal context keep returning v1 format
 * to not break compatibility with logs data format
 */
export function startInternalContext(applicationId, sessionManager, viewContexts, actionContexts, urlContexts) {
  return {
    get: function (startTime) {
      var viewContext = viewContexts.findView(startTime)
      var urlContext = urlContexts.findUrl(startTime)
      var session = sessionManager.findTrackedSession(startTime)
      if (session && viewContext && urlContext) {
        var actionId = actionContexts.findActionId(startTime)
        return {
          application: {
            id: applicationId
          },
          session: {
            id: session.id
          },
          userAction: actionId
            ? {
                id: actionId
              }
            : undefined,
          view: { 
            id: viewContext.id,
            name: viewContext.name,
            url: urlContext.url,
            referrer: urlContext.referrer,
            host: urlContext.host,
            path: urlContext.pathname,
            pathGroup: urlContext.pathGroup,
            urlQuery: urlContext.urlQuery 
          }
        }
      }
    }
  }
}
