require("dotenv").config();
require("./instrument");
const app = require("./app");

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`SADAAR API listening on port ${PORT}`);
});
