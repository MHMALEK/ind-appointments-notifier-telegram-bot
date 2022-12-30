import * as dotenv from 'dotenv';
dotenv.config();

/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import contentful from 'contentful';
const client = contentful.createClient({
  // This is the space ID. A space is like a project folder in Contentful terms
  space: process.env.IND_CONTENT_API_SPACE,
  // This is the access token for this space. Normally you get both ID and the token in the Contentful web app
  accessToken: process.env.IND_CONTENT_API_TOKEN,
});

const getIndServicesContenFromContentFull = async () => {
  try {
    const res = await client.getEntry('6iIBzea4MHGAkhyNYr3urK');
    return (res.fields as any).indData.data;
  } catch (e) {
    return e;
  }
};

export { getIndServicesContenFromContentFull };
