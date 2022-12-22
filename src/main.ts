/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { Menu, MenuFlavor } from '@grammyjs/menu';
import fetch from 'node-fetch';
import dotEnv from 'dotenv';
import { getIndServicesContenFromContentFull } from './content.js';

dotEnv.config();

console.log('55');
const getIndServicesContent = async () => {
  try {
    const res = await getIndServicesContenFromContentFull();
    return res;
  } catch (e) {
    throw new Error(e);
  }
};

const getSoonestAppointmentDataForDesk = async (serviceCode, deskCode) => {
  try {
    const responseObj = await fetch(
      `${process.env.IND_SERVICE_BASE_API}/appointments/soonest?service=${serviceCode}&desk=${deskCode}`,
    );

    console.log('responseObj', responseObj)
    const res: any = await responseObj.json();
    return res;
  } catch (e) {
    throw new Error(e);
  }
};

// const startBot = async () => {};

const { servicesCode, servicesByDesks, desksAndCodeObj } =
  await getIndServicesContent();

/** This is how the dishes look that this bot is managing */
interface SessionData {
  selectedService: string;
  selectedDesk: string;
}
type MyContext = Context & SessionFlavor<SessionData> & MenuFlavor;

const bot = new Bot<MyContext>(process.env.TELEGRAM_BOT_API_TOKEN);

bot.use(
  session({
    initial(): SessionData {
      return { selectedService: null, selectedDesk: null };
    },
  }),
);

const mainText = 'Please select a service';
const serviceMenu = new Menu<MyContext>('service');

for (const serviceType of servicesCode) {
  serviceMenu
    .submenu(
      {
        text: capitalizeFirstLetter(serviceType.label),
        payload: serviceType.code,
      }, // label and payload,
      'select-desk-menu',
      (ctx) => {
        ctx.editMessageText('Please select an IND desk');
        ctx.session.selectedService = serviceType.code;
      },
    )
    .row();
}

const showSoonestAppointmentSlot = (
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
  )} at ${capitalizeFirstLetter(selectedDesk)}!`;
};

const selectDeskMenu = new Menu('select-desk-menu');
selectDeskMenu.dynamic((ctx: MyContext, range) => {
  const service = ctx.session.selectedService;
  const desksForThisService = getIndDesksByService(service);

  if (typeof service !== 'string') throw new Error('No service chosen');
  for (const desk of desksForThisService) {
    range
      .text(
        { text: capitalizeFirstLetter(desk.label), payload: desk.label }, // label and payload
        async (ctx) => {
          await ctx.menu.close();

          const deskCode = desksAndCodeObj.filter(
            (deskObj) => deskObj.label === ctx.match,
          )[0].code;

          (ctx as MyContext).session.selectedDesk = deskCode;

          await ctx.editMessageText(
            selectDeskForService(
              (ctx as MyContext).session.selectedService,
              (ctx as MyContext).session.selectedDesk,
            ),
            { parse_mode: 'HTML' },
          ); // handler

          const res = await getSoonestAppointmentDataForDesk(
            (ctx as MyContext).session.selectedService,
            (ctx as MyContext).session.selectedDesk,
          );

          const inlineKeyboardForBookAppointment = new InlineKeyboard().url(
            'Get it now!',
            `https://oap.ind.nl/oap/en/#/${ctx.session.selectedService}`,
          );

          const deskLabel = desksAndCodeObj.filter(
            (desk) => desk.code === deskCode,
          )[0].label;
          const serviceLabel =
            servicesByDesks[(ctx as MyContext).session.selectedService].label;

          await ctx.editMessageText(
            showSoonestAppointmentSlot(res, serviceLabel, deskLabel),
            {
              reply_markup: inlineKeyboardForBookAppointment,
              parse_mode: 'HTML',
            },
          );

          const inlineKeyboardForCreatANotifier = new InlineKeyboard().url(
            'Notify me please!',
            `${process.env.IND_WEB_APP_BASE_API}/notifier?desk=${
              (ctx as MyContext).session.selectedDesk
            }&service=${(ctx as MyContext).session.selectedService}&userId=${
              ctx.chat.id
            }`,
          );

          await ctx.reply('Do you need a new appointment? Please /start over');
          await ctx.reply(
            'Do you need to get a new appointment sooner? use our service!',
            {
              reply_markup: inlineKeyboardForCreatANotifier,
            },
          );
        },
      )
      .row();
  }
});

selectDeskMenu.back('back to services');

const getIndDesksByService = (selectedService: any) => {
  return servicesByDesks[selectedService].desks;
};

const selectDeskForService = (serviceCode: string, deskCode: string) => {
  const deskLabel = desksAndCodeObj.filter((desk) => desk.code === deskCode)[0]
    .label;
  const serviceLabel = servicesByDesks[serviceCode].label;
  if (deskLabel && serviceLabel) {
    return `You have selected <b>${capitalizeFirstLetter(
      serviceLabel,
    )}</b> for ${capitalizeFirstLetter(deskLabel)}. we are working on it...`;
  } else {
    return 'we can not find the slot at the moment. please try again later or go to IND website directly';
  }
};

serviceMenu.register(selectDeskMenu as any);

bot.use(serviceMenu);

bot.command('start', (ctx) => {
  ctx.reply(mainText, { reply_markup: serviceMenu });
});

// console.log('bot', bot);
bot.catch(console.error.bind(console));
bot.start();

function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}
