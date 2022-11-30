import { Bot, Context, session, SessionFlavor } from 'grammy';
import { Menu, MenuRange } from '@grammyjs/menu';
import fetch from 'node-fetch';
import dotEnv from 'dotenv';

dotEnv.config();

console.log('22222');

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

// const startBot = async () => {};

const { service_types, desks, service_list } = await getIndServicesContent();

/** This is how the dishes look that this bot is managing */
interface Dish {
  id: string;
  name: string;
}

interface SessionData {
  selectedService: string;
  selectedDesk: string;
}
type MyContext = Context & SessionFlavor<SessionData>;

/**
 * All known dishes. Users can rate them to store which ones are their favorite
 * dishes.
 *
 * They can also decide to delete them. If a user decides to delete a dish, it
 * will be gone for everyone.
 */
const dishDatabase: Dish[] = [
  { id: 'pasta', name: 'Pasta' },
  { id: 'pizza', name: 'Pizza' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'entrct', name: 'Entrecôte' },
];

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
  // console.log('serviceType', serviceType);
  serviceMenu
    .submenu(
      { text: serviceType.label, payload: serviceType.service_code }, // label and payload,
      'credits-menu',
      (ctx) => {
        ctx.editMessageText(selectService(serviceType.label), {
          parse_mode: 'HTML',
        }); // handler
        ctx.session.selectedService = serviceType.service_code;
      },
    )
    .row();
}

const selectService = (service: string) =>
  `You have selected this service<b>${service}</b>`;

const deskMenu = new Menu<MyContext>('desk');
deskMenu.dynamic((ctx, range) => {
  const service = ctx.match;
  if (typeof service !== 'string') throw new Error('No service chosen!');
  range // no need for `new MenuRange()` or a `return`
    .text('a', (ctx) => ctx.reply('text'))
    .row()
    .back('Go Back');
});

const settings = new Menu('credits-menu');
settings.dynamic((ctx, range) => {
  const service = ctx.session.selectedService;
  const desks = getIndDesksByService(service);

  if (typeof service !== 'string') throw new Error('No service chosen!');
  for (const desk of desks) {
    // console.log('serviceType', serviceType);
    range
      .text(
        { text: desk.label, payload: desk.code }, // label and payload
        (ctx) => {
          ctx.session.selectedDesk = ctx.match;
          ctx.menu.close();
          ctx.editMessageText(
            selectDeskForService(
              ctx.session.selectedService,
              ctx.session.selectedDesk,
            ),
          ); // handler
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

const selectDeskForService = (service: string, desk: string) =>
  `You have selected this service<b>${service}</b> for desk <b>${desk}<b>`;

serviceMenu.register(settings);

bot.use(serviceMenu);

bot.command('start', (ctx) =>
  ctx.reply(mainText, { reply_markup: serviceMenu }),
);
bot.command('help', async (ctx) => {
  const text =
    'Send /start to see and rate dishes. Send /fav to list your favorites!';
  await ctx.reply(text);
});

bot.catch(console.error.bind(console));
bot.start();

// startBot();
