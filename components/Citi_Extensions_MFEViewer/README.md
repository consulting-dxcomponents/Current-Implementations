# CITI MFE Viewer

## Quick summary

This component displays documents in an embedded viewer.

It supports:

- Single document view
- Multiple document view
- Optional document categories
- Clear loading and error states

## Why this is useful

- One reusable component for many case types
- Works from configuration (minimal code changes)
- Provides a consistent user experience

## Main configuration

Set these key values:

- `mfeURL`: viewer URL
- `mfeTimeout`: wait time for viewer response
- `type`: single vs multi-document mode
- `referenceList`: data source for documents
- field mappings: `documentIdField`, `fileNameField`, `fileURLField`

Optional:

- `categoryField`
- `activeDocField`

## How it works (simple flow)

1. Open viewer in iframe
2. Read document records from data source
3. Prepare document payload
4. Wait for viewer ready signal
5. Send document data to viewer

## Error handling

- Shows error if viewer does not respond within timeout
- Shows error if document data cannot be loaded
- Shows loader while work is in progress

## Notes

- In multi-document mode, active document is loaded first
- Additional document buffers can be fetched on demand
