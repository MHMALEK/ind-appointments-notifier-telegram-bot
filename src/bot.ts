/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { Menu, MenuFlavor } from '@grammyjs/menu';
import * as dotenv from 'dotenv';
import { getIndServicesContenFromContentFull } from './content';
import axios from 'axios';
import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import * as path from 'path';

dotenv.config();

let bot: Bot;
const telegramBotApiToken = process.env.TELEGRAM_BOT_API_TOKEN;

const createBotInstance = (apiToken) => {
  const bot = new Bot(apiToken);
  return bot;
};

process.once('SIGINT', () => bot.stop());
process.once('SIGTERM', () => bot.stop());

// api calls

const fetchIndServicesList = async () => {
  try {
    const res = await getIndServicesContenFromContentFull();
    return res;
  } catch (e) {
    console.log(e);
  }
};

const getSoonestAppointmentDataForDesk = async (serviceCode, deskCode) => {
  const indServiceBASEAPI = process.env.IND_API_BASE_URL;
  try {
    const data = await axios.get(
      `${indServiceBASEAPI}/appointments/soonest?service=${serviceCode}&desk=${deskCode}`,
    );
    return data;
  } catch (e) {
    throw new Error(e);
  }
};

// bot util functions
const closeMenu = async (ctx) => await ctx.menu.close();
const setDeskInSession = (session, desk) => (session.selectedDesk = desk);
const setServiceInSession = (session, service) =>
  (session.selectedService = service);

//   util function
const capitalizeFirstLetter = (string) => {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

type MyContext = Context & SessionFlavor<SessionData> & MenuFlavor;
interface SessionData {
  selectedService: string;
  selectedDesk: string;
  chatId: number;
}

const createSessionForBot = (bot: Bot) => {
  const defaultSessionData = {
    selectedService: null,
    selectedDesk: null,
    chatId: null,
  };
  bot.use(
    session({
      initial(): SessionData {
        return { ...defaultSessionData };
      },
    }),
  );
};

const createAndInitBot = async () => {
  const startMessageText = `Hi, This bot will help you to find the *soonest* time slots for Netherlands IND desks. Please select a service that you need to get an appointment for it.`;

  createSessionForBot(bot);

  // create menus
  const { selectServiceMenu, selectDeskMenu } =
    await createIndAppointmentMenus();

  //   make desk menu children of service menu (so navigation and back button works properly)
  selectServiceMenu.register(selectDeskMenu);

  //   initialze menu in the bot
  bot.use(selectServiceMenu);

  // start command handler
  const startHandler = (ctx: Context & SessionFlavor<SessionData>) => {
    ctx.session.chatId = ctx.message.chat.id;
    ctx.reply(startMessageText, {
      reply_markup: selectServiceMenu,
      parse_mode: 'Markdown',
    });
  };

  initBotStartCommand(bot, startHandler);

  bot.catch(console.error.bind(console));
};

const initBotStartCommand = (bot, cb) => {
  bot.command('start', (ctx) => cb(ctx));
};

const createIndAppointmentMenus = async () => {
  const { servicesCode, servicesByDesks, desks } = await fetchIndServicesList();

  const serviceMenuName = 'select-service-menu';
  const deskMenuName = 'select-desk-menu';

  const selectServiceMenu = new Menu<MyContext & SessionFlavor<any>>(
    serviceMenuName,
  );
  const selectDeskMenu = new Menu<MyContext & SessionFlavor<any>>(deskMenuName);

  const createServiceMenu = () => {
    // render menu
    for (const serviceType of servicesCode) {
      selectServiceMenu
        .submenu(
          {
            text: capitalizeFirstLetter(serviceType.label),
            payload: serviceType.code,
          },
          //  after select any item we will show the desk menu (result)
          deskMenuName,
          (ctx) => {
            // edit select service text and convert for desk menu `Please select an IND desk`
            ctx.editMessageText('Please select an IND desk');
            // save selected service to session for later usage
            setServiceInSession(ctx.session, serviceType.code);
          },
        )
        .row();
    }
  };

  const creteDeskMenu = () => {
    selectDeskMenu.dynamic((ctx: MyContext, range) => {
      // get the selected service on previous step  from session
      const selectedService = ctx.session.selectedService;

      // show error if somehow user didn't select any service
      if (typeof selectedService !== 'string')
        throw new Error('No service chosen');

      //  get the IND desks for this service
      const desksForThisService = getIndDesksByService(
        servicesByDesks,
        selectedService,
      );

      for (const desk of desksForThisService) {
        createDeskMenuItem(range, desk);
      }
    });

    //   add back button to desk menu
    selectDeskMenu.back('back to services');
  };

  const createDeskMenuItem = (range, desk) => {
    // create desk menu item based on service we have selected
    range
      .text(
        { text: capitalizeFirstLetter(desk.label), payload: desk.label }, // label and payload
        async (ctx: Context & SessionFlavor<SessionData>) => {
          // if user clicked on one of the desks in this menu (except back button)
          // close the menus
          await closeMenu(ctx);
          const deskCode = desk.code;
          setDeskInSession(ctx.session, deskCode);

          // show user the selected desk and service
          await ctx.editMessageText(
            sendSelectedDeskAndServiceMessage(
              desks,
              servicesByDesks,
              ctx.session.selectedService,
              ctx.session.selectedDesk,
            ),
            { parse_mode: 'HTML' },
          );

          try {
            // fetch soonest appointment
            const res = await getSoonestAppointmentDataForDesk(
              ctx.session.selectedService,
              ctx.session.selectedDesk,
            );

            const deskLabel = desks[ctx.session.selectedDesk];

            const serviceLabel =
              servicesByDesks[ctx.session.selectedService].label;

            sendMessageShowSoonestAvailableSlot(
              ctx,
              res.data,
              deskLabel,
              serviceLabel,
            );

            const chatId = ctx.chat.id;
            const selectedService = ctx.session.selectedService;
            const selectedDesk = ctx.session.selectedDesk;

            const inlineKeyboardForCreatANotifier = new InlineKeyboard().url(
              'Create a reminder',
              `${process.env.TELEGRAM_APP_API}/get-date?chatId=${chatId}&selectedService=${selectedService}&selectedDesk=${selectedDesk}`,
            );

            await ctx.reply(
              `Do you want to get a notification if a sooner slot became available for ${capitalizeFirstLetter(
                serviceLabel,
              )} at ${capitalizeFirstLetter(
                deskLabel,
              )}? Click on Notify me button and select your prefered date! We will check and notify you if a sooner slot became available.`,
              {
                reply_markup: inlineKeyboardForCreatANotifier,
              },
            );
          } catch (e) {
            console.log(e);
            ctx.reply(
              'We encountered a problem. it might be a problem from IND website. please /start over or try other options',
            );
          }

          await ctx.reply('Do you need a new appointment? Please /start over');
        },
      )
      .row();
  };

  createServiceMenu();
  creteDeskMenu();

  return {
    selectDeskMenu,
    selectServiceMenu,
  };
};

// message util functions
const sendMessageShowSoonestAvailableSlot = async (
  ctx,
  res,
  deskLabel,
  serviceLabel,
) => {
  const inlineKeyboardForBookAppointment = new InlineKeyboard().url(
    'Get it now!',
    `https://oap.ind.nl/oap/en/#/${ctx.session.selectedService}`,
  );

  await ctx.editMessageText(
    createMessageForSoonestAvaibleAppointment(res, serviceLabel, deskLabel),
    {
      reply_markup: inlineKeyboardForBookAppointment,
      parse_mode: 'HTML',
    },
  );
};

const createMessageForSoonestAvaibleAppointment = (
  soonestAppointmentPayload,
  selectedService,
  selectedDesk,
) => {
  return `There is an appointment availble <b>${
    soonestAppointmentPayload.date
  }</b> at <b>${
    soonestAppointmentPayload.startTime
  }</b> for ${capitalizeFirstLetter(
    selectedService,
  )} at ${capitalizeFirstLetter(selectedDesk)}!
 `;
};

const createMessageForApproveNotifier = async (
  selected_date,
  selectedDesk,
  selectedService,
) => {
  const { servicesByDesks, desks } = await fetchIndServicesList();

  const deskLabel = desks[selectedDesk];

  const serviceLabel = servicesByDesks[selectedService].label;

  return `You selected ${selected_date} at for ${capitalizeFirstLetter(
    serviceLabel,
  )} at ${capitalizeFirstLetter(deskLabel)}!
 `;
};

const sendSelectedDeskAndServiceMessage = (
  desks,
  services,
  selectedService: string,
  selectedDesk: string,
) => {
  const deskLabel = desks[selectedDesk];
  const serviceLabel = services[selectedService].label;

  if (deskLabel && serviceLabel) {
    return `You have selected <b>${capitalizeFirstLetter(
      serviceLabel,
    )}</b> for ${capitalizeFirstLetter(deskLabel)}. We are working on it...`;
  } else {
    return 'We can not find the slot at the moment. Please try again later or go to IND website directly';
  }
};

// ind content functions
const getIndDesksByService = (servicesByDesks, selectedService: any) => {
  return servicesByDesks[selectedService].desks;
};

if (!bot) {
  bot = createBotInstance(telegramBotApiToken);
  bot.start();

  createAndInitBot();
}

// express app
const app = express();
app.use(bodyParser.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.listen(process.env.TELEGRAM_APP_PORT, () =>
  console.log(`Server started on port ${process.env.TELEGRAM_APP_PORT}`),
);

app.post('/send-message', async (req, res) => {
  const telegram_chat_id = req.body.telegram_chat_id;
  const message = req.body.message;

  const inlineKeyboardForBookAppointment = new InlineKeyboard().url(
    'Book this slot!',
    `https://oap.ind.nl/oap/en/#/`,
  );

  if (message.includes('We have found a new slot')) {
    // TODO: not great to hardcode the message here but it's a quick dirty implementation
    await bot.api.sendMessage(telegram_chat_id, message, {
      parse_mode: 'HTML',
      reply_markup: inlineKeyboardForBookAppointment,
    });
  } else {
    // send expired message without inline keyboard
    await bot.api.sendMessage(telegram_chat_id, message, {
      parse_mode: 'HTML',
    });
  }

  res.sendStatus(200);
});

app.get('/get-date', (_, res) => {
  res.sendFile(path.join(__dirname, 'datepicker.html'));
});

app.post('/set-date', async (req, res) => {
  const chatId = req.body.chatId;
  const selectedDate = req.body.selectedDate;
  const selectedDesk = req.body.selectedDesk;
  const selectedService = req.body.selectedService;

  const messageForApproveWeGotDate = await createMessageForApproveNotifier(
    selectedDate,
    selectedDesk,
    selectedService,
  );

  try {
    await bot.api.sendMessage(chatId, messageForApproveWeGotDate);

    const data = JSON.stringify({
      date: selectedDate,
      desk: selectedDesk,
      service: selectedService,
      telegram_chat_id: chatId,
      prefered_way_of_communication: 'telegram',
    });

    const config = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:3001/notification/telegram/create',
      headers: {
        'Content-Type': 'application/json',
      },
      data: data,
    };

    await axios.request(config);
    const message = await bot.api.sendMessage(
      chatId,
      'We are processing your request. give us a moment please',
    );
    await bot.api.editMessageText(
      chatId,
      message.message_id,
      'Hooray! We created your notifier! Now We will notify you when a sooner slot became available',
    );
  } catch (e) {
    console.log('ere', JSON.stringify(e));
    await bot.api.sendMessage(
      chatId,
      'something went wrong! please try again and if the problem persists contact us',
    );
  }

  res.sendStatus(200);
});
