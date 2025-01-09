import { ComponentChildren, JSX } from "preact";

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
      <button
        style={{ height: "3em", marginTop: "auto", marginBottom: "auto" }}
        onClick={onGoBack}
      >
        Back
      </button>
      <h1>{children}</h1>
    </header>
  );
}
