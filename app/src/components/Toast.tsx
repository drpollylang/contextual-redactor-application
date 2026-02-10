import * as React from "react";
import { MessageBar, MessageBarType } from "@fluentui/react";

export interface ToastProps {
  message: string;
  type?: MessageBarType;
  onDismiss: () => void;
}

export default function Toast({ message, type = MessageBarType.success, onDismiss }: ToastProps) {
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        right: 20,
        maxWidth: 340,
        zIndex: 200000, // Raise toast notifications over everything else (including project panels)
      }}
    >
      <MessageBar
        messageBarType={type}
        onDismiss={onDismiss}
        isMultiline={false}
      >
        {message}
      </MessageBar>
    </div>
  );
}