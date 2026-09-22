import { onMounted, onUnmounted } from 'vue'
export function useDialogFocus(dialog, initial) {
  const previous = document.activeElement
  onMounted(() => initial.value?.focus())
  onUnmounted(() => previous?.isConnected && previous.focus())
  function trapFocus(event) {
    const controls = [...dialog.value.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')]
    const first = controls[0], last = controls.at(-1)
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
  }
  return { trapFocus }
}
