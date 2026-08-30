const VISIBLE_MS = 2900;

const CHECK_ICON =
  '<svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z"/></svg>';

let toast = null;
let textSlot = null;
let actionButton = null;
let dismissButton = null;
let actionHandler = null;
let hideTimer = null;

function build() {
  toast = document.createElement("div");
  toast.className = "toast";
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");

  const iconSlot = document.createElement("span");
  iconSlot.className = "toast-icon";
  iconSlot.innerHTML = CHECK_ICON;
  textSlot = document.createElement("span");
  actionButton = document.createElement("button");
  actionButton.type = "button";
  actionButton.className = "toast-action";
  actionButton.hidden = true;
  dismissButton = document.createElement("button");
  dismissButton.type = "button";
  dismissButton.className = "toast-dismiss";
  dismissButton.setAttribute("aria-label", "Dismiss");
  dismissButton.textContent = "×";
  dismissButton.hidden = true;
  toast.append(iconSlot, textSlot, actionButton, dismissButton);

  if (Object.hasOwn(HTMLElement.prototype, "popover")) {
    toast.setAttribute("popover", "manual");
  }
  toast.addEventListener("click", () => {
    if (!actionHandler) hideToast();
  });
  actionButton.addEventListener("click", (event) => {
    event.stopPropagation();
    const handler = actionHandler;
    hideToast();
    handler?.();
  });
  dismissButton.addEventListener("click", (event) => {
    event.stopPropagation();
    hideToast();
  });
  toast.addEventListener("transitionend", closePopoverWhenHidden);
  document.body.appendChild(toast);
}

function isPopover() {
  return toast.hasAttribute("popover");
}

// hidePopover() applies display:none at once, which would cut the exit
// transition off before it ran.
function closePopoverWhenHidden(event) {
  if (event.propertyName !== "opacity") return;
  if (toast.classList.contains("toast-visible")) return;
  if (isPopover() && toast.matches(":popover-open")) toast.hidePopover();
}

function hideToast() {
  clearTimeout(hideTimer);
  toast.classList.remove("toast-visible");
}

export function showToast(
  message,
  { actionLabel = "", onAction = null, duration = VISIBLE_MS } = {},
) {
  if (!toast) build();

  const actionable = actionLabel && typeof onAction === "function";
  textSlot.textContent = message;
  actionHandler = actionable ? onAction : null;
  actionButton.textContent = actionLabel;
  actionButton.hidden = !actionable;
  dismissButton.hidden = !actionable;
  toast.classList.toggle("toast-actionable", actionable);
  if (isPopover() && !toast.matches(":popover-open")) toast.showPopover();
  requestAnimationFrame(() => toast.classList.add("toast-visible"));

  clearTimeout(hideTimer);
  if (duration !== null) hideTimer = setTimeout(hideToast, duration);
}
