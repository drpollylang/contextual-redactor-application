# Contextual Redactor

An intelligent, human-in-the-loop document redaction tool powered by a hybrid AI architecture. This application goes beyond simple keyword searching, using multiple AI models to understand context, follow nuanced user instructions, and perform forensically secure redactions on PDF documents.

## Overview

The Contextual Redactor can understand a subjective user request like "redact any quotations that are negative about the parents", and redact accordingly.

The Contextual Redactor uses the right AI toolfor the right job:

1. **Azure Language Service:** A fast, cost-effective, and highly accurate model for identifying structured Personally Identifying Information (PII) like names, addresses, ages, and organizations.
2. **Azure OpenAI (GPT-4o / GPT-4):** A powerful Large Language Model (LLM) for the most complex reasoning tasks:
   * Parsing free-text user instructions into structured commands.
   * Performing entity linking to understand which PII belongs to which person.
   * Analysing and redacting subjective, context-dependent content based on user rules.

This is all wrapped in a React web application that allows a human reviewer to have the final say, correcting the AI's suggestions and adding their own manual redactions with a powerful drawing canvas.

## Features

- **Hybrid AI Analysis:** Combines the strengths of specialized NLP models (for PII) and large language models (for reasoning) for optimal speed, cost, and accuracy.
- **Nuanced Instruction Following:** Users can provide complex, natural language instructions (e.g., "don't redact any PII for Oliver Hughes") which the system intelligently parses and applies.
- **Context-Aware Redaction:** Capable of redacting subjective content, such as opinions or specific types of quotations, based on user-defined rules.
- **Interactive Review UI:** A clear two-column layout allows reviewers to see all AI suggestions, toggle them individually or in groups, and see a live preview of the final document.
- **Full Manual Control:** A powerful drawable canvas allows reviewers to:
  - Draw new redaction boxes directly on the document preview.
  - Edit, move, resize, or delete any redaction box (both AI-generated and manual).
- **"Redact All Occurrences" Power-User Feature:** A user can draw a box over a single word or phrase, and with one click, instruct the system to find and redact every other occurrence of that text in the document. Includes a one-step undo.
- **Forensically Secure Output:** Redactions are not just black boxes placed on top of text. The underlying text and image data is permanently removed from the PDF, and the final file is sanitized to remove metadata, ensuring information is unrecoverable.

## Demo

<video width="75%" controls>
 <source src="demos/demo_redactor_app_270126.mp4" type="video/mp4">
 Your browser does not support the video tag
</video>

*The main user interface, showing the document list and redaction checklist on the left and the interactive document preview on the right.*

## Tech Stack

- **Backend & AI Logic:** Python 3.12+
- **Frontend:** React.js
- **PDF Processing/Viewer/Annotation Layer:** [`react-pdf-highlighter-extended`](https://danielarnould.github.io/react-pdf-highlighter-extended/docs/modules.html), [`pdfjs-dist`](https://www.npmjs.com/package/pdfjs-dist) 
- **AI Services:**
  - **Azure Document Intelligence:** For layout analysis and OCR.
  - **Azure Language Service:** For fast, structured PII and Organization detection.
  - **Azure OpenAI Service:** For GPT-4o / GPT-4.1-mini models for advanced reasoning.
- **Dependency Management:** Poetry, npm

## Setup and Installation

TODO

## Usage

TODO

NOTE: You will need the permissions associated with the roles **Contributor** and **Storage Blob Data Contributor** to use in dev - otherwise, the server will bounce back a 403 Forbidden HTTP error!

In one terminal, to start the Azure Functions backend locally:
```
cd api
npm run build && func start
```

In another terminal, to start the app UI:
```
npm run dev
```

## Project Structure

