import { createStore } from "solid-js/store"

export type ModalType = "add-tab" | "command-palette" | "edit-app" | "theme-picker" | "confirm-delete" | "help" | "onboarding" | "server-update" | null

export interface UIStore {
  activeModal: ModalType
  statusMessage: string | null
}

export function createUIStore() {
  const [store, setStore] = createStore<UIStore>({
    activeModal: null,
    statusMessage: null,
  })

  const openModal = (modal: ModalType) => {
    setStore("activeModal", modal)
  }

  const closeModal = () => {
    setStore("activeModal", null)
  }

  const setStatusMessage = (message: string | null) => {
    setStore("statusMessage", message)
  }

  const showTemporaryMessage = (message: string, durationMs = 3000) => {
    setStore("statusMessage", message)
    setTimeout(() => {
      setStore("statusMessage", (current) => (current === message ? null : current))
    }, durationMs)
  }

  return {
    store,
    openModal,
    closeModal,
    setStatusMessage,
    showTemporaryMessage,
  }
}
