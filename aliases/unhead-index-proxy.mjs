// Minimal shim to provide CapoPlugin for Nuxt's virtual unhead plugin import
// Use a relative filesystem path to bypass package "exports" restrictions.
export { CapoPlugin } from '../node_modules/@unhead/vue/dist/legacy.mjs'
export * from '../node_modules/@unhead/vue/dist/index.mjs'
