# Connect Four Bingo

Connect Four Bingo is a browser-based classroom or event game that builds a 4x4 bingo-style board from a Google Sheet, a CSV file, or direct text input. Players mark squares as terms are used, and a win happens when four marked squares line up across a row, column, or diagonal.

## Features

- Load terms from Google Sheets
- Load terms from a local CSV file
- Enter terms directly in the page
- Use optional definitions for answer keys and printed reference sheets
- Share a board setup with a generated link
- Hide or include the game creation panel in shared links
- Hide or include the answers button in shared links
- Print term/definition sheets
- Print multiple randomized playable boards, one per page
- Mobile-friendly board layout

## Requirements

- Node.js 18 or newer
- A Google Sheets API key if you want to load data from Google Sheets

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root:

```env
GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key_here
```

3. Start the server:

```bash
npm start
```

4. Open the app in your browser:

```text
http://localhost:3000
```

## How To Load A Board

### Google Sheets

Use the **Load Google Sheet** tab and provide:

- the Google Sheets share link
- the sheet tab name
- the cell range

The sheet should be viewable by anyone with the link. The first column should contain the term. The second column may contain a definition, but it is optional.

### CSV File

Use the **Load CSV** tab and choose a local CSV file. The first row should be a header row. The first column should contain the term. The second column may contain a definition, but it is optional.

### Direct Input

Use the **Direct Input** tab and enter one item per line.

Examples:

```text
Photosynthesis
Mitochondria | The powerhouse of the cell
```

If a definition is included, place it after a `|` character. Definitions are optional.

## How To Play

1. Load a set of at least 16 terms.
2. The app will generate a 4x4 board with a random selection of terms.
3. Click or tap a square to mark it.
4. Continue marking squares as terms are spoken or identified.
5. A win happens when four marked squares line up in a row, column, or diagonal.

If the loaded set contains more than 16 terms, the remaining terms appear below the board in the **More terms in this set** section.

## Sharing

After a board is loaded, the app generates a share link in the control panel.

Optional share settings:

- **Include the answers button in shared links**
- **Include game creation panel**

If the game creation panel is not included, the shared page opens in a centered board-only view.

## Printing

The control panel includes two print options:

### Print Terms/Definitions

Opens a print-friendly page containing the full list of terms and definitions.

### Print Playable Boards

Opens a print-friendly page with a chosen number of randomized boards. Each board prints on its own page and includes a list of terms that were not used on that board.

## Notes

- At least 16 terms are required to generate a board.
- Definitions are optional across all input methods.
- CSV files are parsed in the browser and are not uploaded to the server.
- Google Sheets loading is handled by the backend so the API key is not exposed in browser code.
