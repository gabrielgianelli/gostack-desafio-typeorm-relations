import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Could not find customer with this id.');
    }

    const registeredProducts = await this.productsRepository.findAllById(
      products,
    );

    if (!registeredProducts.length) {
      throw new AppError('Could not find any products.');
    }

    const productsIds = registeredProducts.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !productsIds.includes(product.id),
    );

    if (inexistentProducts.length) {
      throw new AppError(
        `Could not find the product ${inexistentProducts[0].id}.`,
      );
    }

    const productsWithInsufficientQuantities = registeredProducts.filter(
      registeredProduct =>
        products.filter(product => product.id === registeredProduct.id)[0]
          .quantity > registeredProduct.quantity,
    );

    if (productsWithInsufficientQuantities.length) {
      throw new AppError(
        `Ordered quantity of the product ${productsWithInsufficientQuantities[0].id} is not avaiable.`,
      );
    }

    const orderedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: registeredProducts.filter(
        registeredProduct => registeredProduct.id === product.id,
      )[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer,
      products: orderedProducts,
    });

    await this.productsRepository.updateQuantity(
      orderedProducts.map(orderedProduct => ({
        id: orderedProduct.product_id,
        quantity:
          registeredProducts.filter(
            registeredProduct =>
              registeredProduct.id === orderedProduct.product_id,
          )[0].quantity - orderedProduct.quantity,
      })),
    );

    return order;
  }
}

export default CreateOrderService;
