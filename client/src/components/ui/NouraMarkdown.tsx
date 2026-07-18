import ReactMarkdown from "react-markdown";

/*
  Minimal, tightly styled markdown rendering for chat bubbles. Turns
  Noura's occasional bold text or short numbered list into real
  visual structure instead of literal asterisks and dashes showing up
  as plain characters.
*/
export const NouraMarkdown = ({ text }: { text: string }) => (
  <ReactMarkdown
    components={{
      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
      strong: ({ children }) => (
        <strong className="font-semibold">{children}</strong>
      ),
      ul: ({ children }) => (
        <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>
      ),
      li: ({ children }) => <li>{children}</li>,
    }}
  >
    {text}
  </ReactMarkdown>
);
