import { ComponentChildren } from "preact";
import clsx from "clsx";
import styles from "./button.module.css";
import { JSX } from "preact";

export default function Button({
  children,
  kind = "normal",
  ...props
}: {
  children: ComponentChildren;
  kind?: "normal" | "error";
} & JSX.AllHTMLAttributes<HTMLButtonElement>) {
  return (
    <button {...props} className={clsx(styles.button, styles[kind])}>
      {children}
    </button>
  );
}
