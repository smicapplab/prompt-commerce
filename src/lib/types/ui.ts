import type { Snippet } from 'svelte';

export interface ButtonProps {
    type?: "button" | "submit" | "reset";
    variant?: "primary" | "secondary" | "danger" | "ghost" | "outline";
    size?: "sm" | "md" | "lg" | "icon";
    class?: string;
    href?: string;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
    [key: string]: any;
}

export interface CardProps {
    class?: string;
    children?: Snippet;
    [key: string]: any;
}

export interface InputProps {
    label?: string;
    id?: string;
    type?: string;
    placeholder?: string;
    value?: string | number | undefined;
    disabled?: boolean;
    required?: boolean;
    error?: string;
    class?: string;
    left?: Snippet;
    right?: Snippet;
    labelExtra?: Snippet;
    onkeydown?: (e: KeyboardEvent) => void;
    oninput?: (e: Event) => void;
    onchange?: (e: Event) => void;
    [key: string]: any;
}

export interface SelectProps {
    label?: string;
    id?: string;
    value?: string | number | undefined;
    options: { value: string | number; label: string }[];
    disabled?: boolean;
    required?: boolean;
    error?: string;
    class?: string;
    left?: Snippet;
    onchange?: (e: Event) => void;
    [key: string]: any;
}

export interface BadgeProps {
    variant?: "success" | "warning" | "danger" | "info" | "neutral" | "primary" | "secondary";
    size?: "sm" | "md";
    class?: string;
    children?: Snippet;
}

export interface ToggleProps {
    id?: string;
    checked?: boolean;
    label?: string;
    description?: string;
    disabled?: boolean;
    class?: string;
    onchange?: (e: Event) => void;
    [key: string]: any;
}
