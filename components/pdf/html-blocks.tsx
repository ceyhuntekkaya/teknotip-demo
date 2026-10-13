import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";
import type { ReactNode } from "react";
import { parseHtmlBlocks, type Inline } from "@/lib/pdf/html-blocks";

function inlineNodes(nodes: Inline[]): ReactNode[] {
  return nodes.map((node, index) => {
    if (node.type === "text") return node.text;
    if (node.type === "br") return "\n";
    if (node.type === "strong") {
      return (
        <Text key={index} style={{ fontWeight: 700 }}>
          {inlineNodes(node.children)}
        </Text>
      );
    }
    return (
      <Text key={index} style={{ fontStyle: "italic" }}>
        {inlineNodes(node.children)}
      </Text>
    );
  });
}

export function HtmlBlocks({
  html,
  paragraphStyle,
  listStyle,
}: {
  html: string;
  paragraphStyle: Style;
  listStyle: Style;
}) {
  const blocks = parseHtmlBlocks(html);
  if (blocks.length === 0) return null;

  return (
    <View>
      {blocks.map((block, index) => {
        if (block.type === "p") {
          return (
            <Text key={index} style={[paragraphStyle, { marginBottom: 4 }]}>
              {inlineNodes(block.children)}
            </Text>
          );
        }
        const ordered = block.type === "ol";
        return (
          <View key={index} style={{ marginTop: 4 }}>
            {block.items.map((item, itemIndex) => (
              <Text key={itemIndex} style={listStyle}>
                {ordered ? `${itemIndex + 1}. ` : "• "}
                {inlineNodes(item)}
              </Text>
            ))}
          </View>
        );
      })}
    </View>
  );
}
