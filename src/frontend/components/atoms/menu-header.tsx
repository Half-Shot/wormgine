import { ComponentChildren, JSX } from "preact";
import Button from "./button";

const menuStyle: JSX.CSSProperties = {
  display: "flex",
  gap: "1em",
};

export default function MenuHeader({
  children,
  onGoBack,
}: {
  children: ComponentChildren;
  onGoBack: () => void;
}) {
  return (
    <header style={menuStyle}>
      <Button
        style={{ height: "3em", marginTop: "auto", marginBottom: "auto" }}
        onClick={onGoBack}
      >
        Back
      </Button>
      <h1>{children}</h1>
    </header>
  );
}
