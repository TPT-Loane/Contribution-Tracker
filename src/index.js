const express = require("express");     // Serve the page at a 'localhost' near you.
const fetch = require("node-fetch");    // Make GraphQL queries and such.
const path = require("path");           // Use files in directory.
require('dotenv').config();             // Use 'process.env.ENV_VARIABLE' to use '.env' file vars.

const app = express();

const port = process.env.PORT || 3000;  // Use port found in '.env' or default back to port '3000'

/* GraphQL query that gets sent to github API */
const graphqlQuery = `
{
  organization(login: "TPT-Loane") {
    repository(name: "TPT-Loane") {
      issues(last: 100) {
        nodes {
          number
          author {
            login
          }
        }
      }
    }
  }
}
`;

/* Serve static pages from the 'public' directory */
app.use(express.static(path.join(__dirname, 'public')));

app.get("/data", (req, res) => {
  /* Get data from github and return JSON */
  fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`
    },
    body: JSON.stringify({
      query: graphqlQuery
    })
  })
    .then(result => {
      return result.json();
    })
    .then(data => {
      res.send(data);
    });
});

app.listen(port, () => console.log(`Listening on port ${port}`));