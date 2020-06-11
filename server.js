const express = require("express");
const { ApolloServer, gql } = require("apollo-server-express");
const merge = require("lodash/merge");
const mongoose = require("mongoose");
const { PubSub } = require("apollo-server");
const { createServer } = require("http");
require("dotenv").config();

const { cardResolvers, cardTypeDefs } = require("./src/card");
const { sectionResolvers, sectionTypeDefs } = require("./src/section");

const cardModel = require("./src/card/model");
const sectionModel = require("./src/section/model");
const SUBSCRIPTION_CONSTANTS = require("./src/constants");

const typeDefs = gql`
    type Subscription {
        sectionAdded: Section
        cardAdded: Card
        onSectionPosChange: Section
        onCardPosChange: Card
    }
    ${cardTypeDefs}
    ${sectionTypeDefs}
`;

const pubsub = new PubSub();

const SubscriptionsResolvers = {
    Subscription: {
        sectionAdded: {
            subscribe: () =>
                pubsub.asyncIterator([SUBSCRIPTION_CONSTANTS.SECTION_ADDED]),
        },
        cardAdded: {
            subscribe: () =>
                pubsub.asyncIterator([SUBSCRIPTION_CONSTANTS.CARD_ADDED]),
        },
        onSectionPosChange: {
            subscribe: () =>
                pubsub.asyncIterator([SUBSCRIPTION_CONSTANTS.ON_SECTION_POS_CHANGE]),
        },
        onCardPosChange: {
            subscribe: () =>
                pubsub.asyncIterator([SUBSCRIPTION_CONSTANTS.ON_CARD_POS_CHANGE]),
        },
    },
};

const customResolvers = {
    Section: {
        cards(parent, args, cxt) {
            return cxt.card.getCardBySectionId(parent._id);
        },
    },
};

const resolvers = merge(
    cardResolvers,
    sectionResolvers,
    customResolvers,
    SubscriptionsResolvers
);


const MONGO_USER = process.env.MONGO_USER || "root";
const MONGO_PASS = process.env.MONGODB_PASS;
const dbName = "trellodb";
mongoose
    .connect(
        `mongodb+srv://${MONGO_USER}:${MONGO_PASS}@cluster0-v02nn.azure.mongodb.net/${dbName}?retryWrites=true&w=majority`,
        { useNewUrlParser: true, useUnifiedTopology: true }
    )
    .then(() => {
        console.log("mongodb connected successfully");

        const server = new ApolloServer({
            typeDefs,
            resolvers,
            context: () => ({
                card: cardModel,
                section: sectionModel,
                publisher: pubsub,
                SUBSCRIPTION_CONSTANTS: SUBSCRIPTION_CONSTANTS,
            }),
        });

        const app = express();
        server.applyMiddleware({ app });

        const httpServer = createServer(app);
        server.installSubscriptionHandlers(httpServer);

        const PORT = process.env.PORT || 4444;
        httpServer.listen({ port: PORT }, () => {
            console.log(`Server is running in port ${PORT}`);
        });
    })
    .catch((err) => {
        console.log(err);
    });