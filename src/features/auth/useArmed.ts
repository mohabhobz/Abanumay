import { useState } from 'react'

/* 10 Oct · password managers (the iCloud Passwords extension, among others) put up their prompt
   the moment the page loads something that looks like a sign-in form. Until the user goes to a
   field the form doesn't look like one: no method/action, no field names, autofill off, and the
   password drawn as dots on a plain text field. The first press or focus anywhere in the form
   arms all of it at once (the manager needs the user and password fields together), so the
   prompt comes when the user goes to the field, not on load. Where the manager then draws its
   prompt is its own choice, not the page's. */
export function useArmed() {
  const [armed, setArmed] = useState(false)
  const arm = () => { if (!armed) setArmed(true) }
  const form = armed ? { method: 'post', action: '#' } : {}
  return { armed, formProps: { ...form, onPointerDownCapture: arm, onFocusCapture: arm } }
}
