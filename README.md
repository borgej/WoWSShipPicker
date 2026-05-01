# WoWS Ship Picker

WoWS Ship Picker is a web-based tool designed to help you randomly select a World of Warships ship to play. It allows you to connect to your Wargaming account to load your available ships, apply filters based on tier, nation, and type, and spin a wheel to pick your next battle vessel. It is especially useful for streamers, featuring a green screen mode and a customisable wheel palette.

## Live Demo

You can use the app live in your browser (no download needed) at:
**[https://www.bjsolutions.no/WoWSShipPicker](https://www.bjsolutions.no/WoWSShipPicker)**

## Features

- **Wargaming Authentication**: Log in securely using Wargaming's official OAuth to automatically fetch your owned ships and statistics.
- **Advanced Filtering**: Filter ships by tier range, ship type, and nation to narrow down your choices.
- **Random Ship Wheel**: A fun, animated spinning wheel to randomly select your next ship. Options include custom palettes, tick sounds, confetti, and randomised spin orders.
- **Statistics View**: Check your win rates and battle counts for your ships across different game modes (Random, Ranked, Co-op).
- **Green Screen Mode**: Easily integrate the ship spinner into your stream using the built-in green screen mode.
- **Light/Dark Theme**: Toggle between light and dark modes to suit your preference.
- **Ship History**: Keeps track of recently picked ships.

## Local Development

To run the application locally, you will need [Node.js](https://nodejs.org/) installed on your machine.

### Setup Instructions

1. Clone or download this repository.
2. In the project directory, you will find a file named `local.config.example.js`. Copy this file and rename it to `local.config.js`.
3. Open `local.config.js` and fill in your Wargaming Application ID (`WOWS_APP_ID`). You can obtain an application ID from the [Wargaming Developer Room](https://developers.wargaming.net/).

```javascript
// local.config.js
module.exports = {
  WOWS_APP_ID: 'YOUR_WARGAMING_APP_ID_HERE',
  GA_MEASUREMENT_ID: '', // Optional: Google Analytics ID
  WG_BASE_PATH: '',
  WG_CALLBACK_BASE: 'http://localhost:3001'
};
```

### Running the Server

Run the following command in the project root:

```bash
node server.js
```

Then, open your web browser and navigate to:
`http://localhost:3001`

## Publishing

The project includes a `publish.bat` script that can be used to prepare the files for deployment. It helps clean up the output and handles the necessary file copying for production.
