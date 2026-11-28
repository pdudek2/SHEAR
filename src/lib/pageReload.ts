export const reloadPage = { now: () => window.location.reload() }

// Differs after every page load, so route state written before a reload can be told apart from this load's.
export const pageLoadId = `${Date.now()}-${Math.random()}`
