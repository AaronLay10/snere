const bcrypt = require("bcrypt");
const hash = "$2b$12$Q/PDd.QMLMymNZO7dTvZz.XVCio/8.90hU8rinJIWowMAszOgojje";
const password = "changeme123!";
bcrypt.compare(password, hash).then(result => {
  console.log("Password matches:", result);
  process.exit(0);
});
