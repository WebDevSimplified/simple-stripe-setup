import "dotenv/config"

import { serve } from "@hono/node-server"
import { Hono } from "hono"
import products from "./data/products.json"
import user from "./data/user.json"
import { cors } from "hono/cors"
import Stripe from "stripe"
import { addOwnedProduct, getOwnedProducts } from "./lib/ownedProducts.js"
import { zValidator } from "@hono/zod-validator"
import z from "zod"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-06-30.basil",
})

const handledSessions = new Set<string>()

const app = new Hono()

app.use("*", cors())

app.get("/products", c => {
  return c.json(products)
})

app.get("/owned-products", async c => {
  return c.json(await getOwnedProducts(user.id))
})

// TODO: Handle purchase logic
app.post("/products/:id/create-checkout-session", async c => {
  const { id } = c.req.param()
  const product = products.find(p => p.id === id)
  if (product == null) return c.notFound()

  let customerId = user.stripeCustomerId
  if (customerId == null) {
    const customer = await stripe.customers.create({
      name: user.name,
      email: user.email,
      metadata: {
        userId: user.id,
      },
    })
    customerId = customer.id
    // TODO: Save customer ID to the user in the DB
  }

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: "usd",
          unit_amount: product.price * 100,
          product_data: {
            name: product.name,
            description: product.description,
          },
        },
        quantity: 1,
      },
    ],
    metadata: {
      productId: product.id,
      userId: user.id,
    },
    success_url:
      "http://localhost:3000/purchase/success?sessionId={CHECKOUT_SESSION_ID}",
    cancel_url: "http://localhost:5173/",
  })

  if (session.url == null) throw new Error("Session URL is null")

  return c.redirect(session.url)
})

app.post("/webhooks/stripe", async c => {
  const signature = c.req.header("stripe-signature")
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (signature == null || secret == null) {
    return c.text("Error", 400)
  }

  try {
    const event = stripe.webhooks.constructEvent(
      await c.req.raw.text(),
      signature,
      secret
    )
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        const success = await fulfillPayment(event.data.object.id)
        if (!success) return c.text("Error", 400)
        break
    }

    return c.text("Success", 200)
  } catch (err) {
    return c.text("Error", 400)
  }
})

app.get(
  "/purchase/success",
  zValidator(
    "query",
    z.object({
      sessionId: z.string(),
    })
  ),
  async c => {
    const { sessionId } = c.req.query()
    if (sessionId == null) return c.text("Error", 400)

    const success = await fulfillPayment(sessionId)
    if (!success) return c.text("Error", 400)

    return c.redirect("http://localhost:5173")
  }
)

async function fulfillPayment(sessionId: string) {
  const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["line_items"],
  })
  if (checkoutSession.payment_status === "unpaid") {
    return false
  }

  const productId = checkoutSession.metadata?.productId
  const userId = checkoutSession.metadata?.userId
  if (productId == null || userId == null) {
    return false
  }

  if (checkoutSession.line_items?.data[0].quantity == null) {
    return false
  }

  if (!handledSessions.has(sessionId)) {
    handledSessions.add(sessionId)
    await addOwnedProduct(
      userId,
      productId,
      checkoutSession.line_items.data[0].quantity
    )
  }

  return true
}

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  info => {
    console.log(`Server is running on http://localhost:${info.port}`)
  }
)
