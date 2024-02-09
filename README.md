# IND Appointment Notifier

IND Appointment Notifier is a hobby project developed for educational purposes. It uses the Telegram API, the Grammy.js Node.js wrapper for Telegram, and Express API to fetch data and send updates to users. It connects to an external API project to fetch the available appointments and desks from IND (Immigration and Naturalisation Service in the Netherlands).

## Disclaimer

This project is not intended for real-world use and should not be used to disrupt or negatively impact IND's operations or any individuals using IND's services. Misuse of this project for anything other than learning is strongly discouraged, and the developer will not be responsible for any legal consequences that may arise from such misuse.

If IND requests the removal of this project, we will comply immediately. This project respects the rights and authorities of IND and is committed to adhering to any and all of IND's requests regarding the use or removal of the project.

## Setup and Installation

1. Clone the repository to your local machine.

2. Install the required dependencies:

```bash
npm install
```

Set up the environment variables in a .env based on the example.

```
TELEGRAM_BOT_API_TOKEN=TELEGRAM_BOT_API_TOKEN
IND_API_BASE_URL=IND_API_BASE_URL

# I used some Content service to get IND services and desk
IND_CONTENT_API_SPACE=IND_CONTENT_API_SPACE
IND_CONTENT_API_TOKEN=IND_CONTENT_API_TOKEN

# the API that you can use to get/send data from bot
TELEGRAM_APP_API=TELEGRAM_APP_API
TELEGRAM_APP_PORT=3003
``

Run the server:

```bash
npm run start
```

## Usage

The Telegram bot allows users to view available IND appointments and desks. Users can also set up a notifier to receive a notification when a sooner slot becomes available at a chosen desk or for a chosen service.


##  Disclaimer

This Telegram bot is a component of a hobby project and is intended for educational purposes only. It allows users to view available IND (Immigration and Naturalisation Service in the Netherlands) appointments and desks. If desired, users can also set up a notifier to receive a notification when a sooner slot becomes available for a chosen service or desk.


However, please note that this project is not intended for real-world use and should not be used to disrupt or negatively impact IND's operations or any individuals using IND's services. Misuse of this project for anything other than learning is strongly discouraged, and the developer will not be responsible for any legal consequences that may arise from such misuse.


If IND requests the removal of this project, we will comply immediately. This project respects the rights and authorities of IND and is committed to adhering to any and all of IND's requests regarding the use or removal of the project.


Please respect IND's rules and regulations when using this project and do not use it in a way that may cause inconvenience or harm to IND or any individuals using IND's services.

## Contributing

This project is open for contributions. Please open an issue first to discuss what you would like to change or add.


## License

This project is licensed under the MIT License.

