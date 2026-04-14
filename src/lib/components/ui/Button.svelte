<script lang="ts">
  let {
    type = "button",
    variant = "primary",
    size = "md",
    class: className = "",
    href = undefined,
    disabled = false,
    onclick = undefined,
    children,
    ...rest
  } = $props<{
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
    size?: "sm" | "md" | "lg" | "icon";
    class?: string;
    href?: string;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: any;
    [key: string]: any;
  }>();

  const baseClasses =
    "inline-flex items-center justify-center gap-2 font-bold transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none";

  const variantClasses: Record<string, string> = {
    primary:
      "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500 outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1",
    secondary:
      "bg-white text-gray-700 shadow-sm border border-gray-200 hover:bg-gray-50",
    danger: "bg-red-600 text-white shadow-sm hover:bg-red-500",
    outline: "text-gray-700 border border-gray-200 hover:bg-gray-50",
    ghost: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
  };

  const sizeClasses: Record<string, string> = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2.5 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
    icon: "p-2 rounded-xl",
  };
</script>

{#if href}
  <a
    {href}
    class="{baseClasses} {variantClasses[variant]} {sizeClasses[
      size
    ]} {className}"
    {...rest}
  >
    {#if children}
      {@render children()}
    {/if}
  </a>
{:else}
  <button
    {type}
    class="{baseClasses} {variantClasses[variant]} {sizeClasses[
      size
    ]} {className}"
    {disabled}
    {onclick}
    {...rest}
  >
    {#if children}
      {@render children()}
    {/if}
  </button>
{/if}
