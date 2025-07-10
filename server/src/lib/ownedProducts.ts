import { readFile, writeFile } from "node:fs/promises"

type OwnedProduct = {
  id: string
  quantity: number
}

export function getOwnedProducts(userId: string) {
  return readFile(new URL("../data/ownedProducts.json", import.meta.url))
    .then(data => JSON.parse(data.toString()))
    .then((ownedProducts: Record<string, OwnedProduct[]>) => {
      return ownedProducts[userId] || []
    })
}

export async function addOwnedProduct(
  userId: string,
  productId: string,
  quantity: number,
) {
  const allOwnedProducts: Record<string, OwnedProduct[]> = await readFile(
    new URL("../data/ownedProducts.json", import.meta.url),
  ).then(data => JSON.parse(data.toString()))
  allOwnedProducts[userId] ??= []
  const ownedProducts = allOwnedProducts[userId]
  const existingProduct = ownedProducts.find(p => p.id === productId)

  if (existingProduct) {
    existingProduct.quantity += quantity
  } else {
    ownedProducts.push({ id: productId, quantity })
  }

  return writeFile(
    new URL("../data/ownedProducts.json", import.meta.url),
    JSON.stringify(allOwnedProducts, null, 2),
  )
}
