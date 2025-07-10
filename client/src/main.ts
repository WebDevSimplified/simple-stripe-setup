import "./style.css"

async function setupProducts() {
  const products: {
    id: number
    name: string
    price: number
    description: string
  }[] = await fetch("http://localhost:3000/products").then(res => res.json())
  const ownedProducts: {
    id: string
    quantity: number
  }[] = await fetch("http://localhost:3000/owned-products").then(res =>
    res.json()
  )

  const productsContainer = document.querySelector<HTMLDivElement>("#products")
  if (!productsContainer) {
    throw new Error("Products container not found")
  }

  products.forEach(product => {
    const ownedQuantity =
      ownedProducts.find(
        ownedProduct => ownedProduct.id === product.id.toString()
      )?.quantity ?? 0
    const productElement = document.createElement("div")
    productElement.classList.add("product")
    productElement.innerHTML = `
      <h2>${product.name} <small>${ownedQuantity}</small></h2>
      <p>${product.description}</p>
      <p>Price: ${new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
      }).format(product.price)}</p>
      <form action="http://localhost:3000/products/${
        product.id
      }/create-checkout-session" method="POST">
        <button>Purchase</button>
      </form>`

    productsContainer.appendChild(productElement)
  })
}

setupProducts()
