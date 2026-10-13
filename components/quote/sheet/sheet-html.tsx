import type { ReactNode } from "react";
import { parseHtmlBlocks, type Inline } from "@/lib/pdf/html-blocks";

function inlineNodes(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.text;
    if (node.type === "br") return <br key={index} />;
    if (node.type === "strong") {
      return <strong key={index}>{inlineNodes(node.children)}</strong>;
    }
    return <em key={index}>{inlineNodes(node.children)}</em>;
  });
}

export function SheetHtml({
  html,
  className,
}: {
  html: string;
  className: string;
}) {
  const blocks = parseHtmlBlocks(html);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        if (block.type === "p") {
          return <p key={index}>{inlineNodes(block.children)}</p>;
        }
        const ordered = block.type === "ol";
        const Tag = ordered ? "ol" : "ul";
        return (
          <Tag key={index}>
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                {ordered ? `${itemIndex + 1}. ` : "• "}
                {inlineNodes(item)}
              </li>
            ))}
          </Tag>
        );
      })}
    </div>
  );
}
