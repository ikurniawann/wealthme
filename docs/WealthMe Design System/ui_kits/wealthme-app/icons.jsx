/* WealthMe UI-kit — Lucide icon as a React-managed <svg> (re-render safe). */
function WMIcon({
  name,
  size = 18,
  stroke = 1.75,
  color = "currentColor",
  style,
}) {
  const html = React.useMemo(() => {
    const lib = window.lucide;
    if (!lib) return "";
    // lucide UMD exposes icons either under `.icons` or as top-level PascalCase nodes
    const node = (lib.icons && lib.icons[name]) || lib[name];
    if (!Array.isArray(node)) return "";
    // Lucide icon node shape: ["svg", attrs, [[tag, attrs], ...]] — take the inner children.
    const children = Array.isArray(node[2]) ? node[2] : node;
    return children
      .filter((c) => Array.isArray(c))
      .map(([tag, attrs]) => {
        const a = Object.entries(attrs || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(" ");
        return `<${tag} ${a} />`;
      })
      .join("");
  }, [name]);
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
window.WMIcon = WMIcon;
