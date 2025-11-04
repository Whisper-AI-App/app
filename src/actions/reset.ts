import { initStore, store } from "../store";

export function resetEverything() {
    store.delValues()
    store.delTables()
    initStore()
}