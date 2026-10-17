/**
 * Decides whether a freshly synced content update may re-render the open page right now.
 * Re-rendering by remounting wipes unsaved form input and in-flight state (checkout, payment), so the update is held
 * back in those cases and applied on the next navigation, when the page is replaced anyway.
 */
export const REMOUNT_PROTECTED_PREFIXES = ['/checkout', '/prime-membership/checkout', '/order-confirmation', '/cart', '/account', '/login'];

export function isRemountProtectedPath(pathname: string): boolean {
  return REMOUNT_PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function canApplyContentUpdateNow(state: { pathname: string; userTyped: boolean; fieldFocused: boolean }): boolean {
  return !isRemountProtectedPath(state.pathname) && !state.userTyped && !state.fieldFocused;
}

export const isEditableElement = (el: Element | null | undefined): boolean => {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement).isContentEditable === true;
};
