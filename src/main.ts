/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Bot, Context, session, SessionFlavor, InlineKeyboard } from 'grammy';
import { Menu } from '@grammyjs/menu';
import fetch from 'node-fetch';
import dotEnv from 'dotenv';

dotEnv.config();

console.log('22');

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getIndServicesContent = async () => {
  try {
    const responseObj = await fetch(
      `${process.env.IND_CONTENT_API_BASE_URL}/service-desk`,
      {
        headers: {
          Authorization: `Bearer ${process.env.IND_CONTENT_API_TOKEN}`,
        },
      },
    );

    const res: any = await responseObj.json();

    const {
      data: { attributes },
    } = res;

    return {
      ...attributes,
    };
  } catch (e) {
    throw new Error(e);
  }
};

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const getSoonestAppointmentDataForDesk = async (serviceCode, deskCode) => {
  try {
    const responseObj = await fetch(
      `${process.env.IND_SERVICE_BASE_API}/appointments/soonest?service=${serviceCode}&desk=${deskCode}`,
    );

    const res: any = await responseObj.json();

    return res;
  } catch (e) {
    throw new Error(e);
  }
};

// const startBot = async () => {};

const { service_types, desks, service_list } = await getIndServicesContent();

// console.log('service_types', service_types, desks);

/** This is how the dishes look that this bot is managing */
interface SessionData {
  selectedService: string;
  selectedDesk: string;
}
type MyContext = Context & SessionFlavor<SessionData>;

const bot = new Bot<MyContext>(
  '5745105271:AAFDscbS35w00wT3SXk0c_u180YHSMts1U4',
);

bot.use(
  session({
    initial(): SessionData {
      return { selectedService: null, selectedDesk: null };
    },
  }),
);

const mainText = 'Please select a service';
const serviceMenu = new Menu<MyContext>('service');

for (const serviceType of service_types) {
  serviceMenu
    .submenu(
      { text: serviceType.label }, // label and payload,
      'select-desk-menu',
      (ctx) => {
        ctx.editMessageText('Please select an IND desk');
        ctx.session.selectedService = serviceType.service_code;
      },
    )
    .row();
}

const showSoonestAppointmentSlot = (soonestAppointmentPayload) => {
  return `there is an appointment for <b>${soonestAppointmentPayload.date}</b> at <b>${soonestAppointmentPayload.startTime}</b>!`;
};

const selectDeskMenu = new Menu('select-desk-menu');
selectDeskMenu.dynamic((ctx: any, range) => {
  const service = ctx.session.selectedService;
  const desksForThisService = getIndDesksByService(service);

  if (typeof service !== 'string') throw new Error('No service chosen');
  for (const desk of desksForThisService) {
    range
      .text(
        { text: desk.label, payload: desk.label }, // label and payload
        async (ctx) => {
          await ctx.reply(
            'we are fetching data for you... please wait for a moment',
          );

          await ctx.menu.close();

          const deskCode = desks.filter(
            (deskObj) => deskObj.label === ctx.match,
          )[0].code;

          ctx.session.selectedDesk = deskCode;

          await ctx.editMessageText(
            selectDeskForService(
              ctx.session.selectedService,
              ctx.session.selectedDesk,
            ),
          ); // handler

          const res = await getSoonestAppointmentDataForDesk(
            ctx.session.selectedService,
            ctx.session.selectedDesk,
          );

          const inlineKeyboard = new InlineKeyboard().url(
            'Get it now!',
            `https://oap.ind.nl/oap/en/#/${ctx.session.selectedService}`,
          )

          await ctx.reply(showSoonestAppointmentSlot(res), {
            reply_markup: inlineKeyboard,
            parse_mode: 'HTML',
          });

          await ctx.reply(
            'Do you need a new appointment or want to change the desk or service? Please /start over',
          );
        },
      )
      .row();
  }
});

const getIndDesksByService = (selectedService: any) => {
  const indServiceData: any = service_types.filter(
    (service: any) => service.service_code === selectedService,
  );

  return indServiceData[0].desks;
};

const selectDeskForService = (serviceCode: string, deskCode: string) => {
  const deskLabel = desks.filter((desk) => desk.code === deskCode)[0].label;
  const serviceLabel = service_list[serviceCode];
  if (deskLabel && serviceLabel) {
    return `You have selected ${serviceLabel} for ${deskLabel}`;
  } else {
    return 'we can not find the slot at the moment. please try again later or go to IND website directly';
  }
};

serviceMenu.register(selectDeskMenu as any);

bot.use(serviceMenu);

bot.command('start', (ctx) =>
  ctx.reply(mainText, { reply_markup: serviceMenu }),
);

bot.catch(console.error.bind(console));
bot.start();

// startBot();
