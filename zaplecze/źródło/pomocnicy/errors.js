'use strict';

const ERRORS = {
  SERVER_ERROR: 'Błąd serwera',
  UNAUTHORIZED: 'Brak uprawnień',
  FORBIDDEN: 'Brak dostępu',
  STORE_NOT_FOUND: 'Sklep nie znaleziony',
  STORE_NOT_OWNED: 'Brak uprawnień do tego sklepu',
  NO_STORE: 'Nie masz jeszcze sklepu',
  PRODUCT_NOT_FOUND: 'Produkt nie znaleziony',
  ORDER_NOT_FOUND: 'Zamówienie nie znalezione'
};

const HTTP = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  SERVER_ERROR: 500
};

module.exports = { ERRORS, HTTP };
