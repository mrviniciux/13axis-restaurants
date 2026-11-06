import { describe, expect, it } from 'vitest';
import {
  parseAddOrderItemInput,
  parseCreateOrderInput,
  parseDeleteOrderItemInput,
  parseUpdateOrderItemInput,
} from './order-input';
import { ApiProblemError } from './problem';

const validInput = {
  id: '0192f4a8-2c3d-7abc-8def-0123456789ab',
  tableId: '0192f4a8-2c3d-7abc-8def-0123456789ac',
};

describe('parseCreateOrderInput', () => {
  it('accepts a table-linked command and defaults deviceId to null', () => {
    expect(parseCreateOrderInput(validInput)).toEqual({
      ...validInput,
      comandaNumber: null,
      deviceId: null,
    });
  });

  it('accepts an independent command without a table ID', () => {
    expect(parseCreateOrderInput({ id: validInput.id })).toEqual({
      id: validInput.id,
      comandaNumber: null,
      tableId: null,
      deviceId: null,
    });
  });

  it('normalizes an explicitly null table ID for an independent command', () => {
    expect(parseCreateOrderInput({ id: validInput.id, tableId: null })).toEqual({
      id: validInput.id,
      comandaNumber: null,
      tableId: null,
      deviceId: null,
    });
  });

  it('accepts a positive comanda number', () => {
    expect(parseCreateOrderInput({ id: validInput.id, comandaNumber: 20 })).toMatchObject({
      comandaNumber: 20,
      tableId: null,
    });
  });

  it.each([0, -1, 1.5, 2_147_483_648, '20'])('rejects invalid comanda number %s', (number) => {
    expect(() => parseCreateOrderInput({ id: validInput.id, comandaNumber: number })).toThrow(
      ApiProblemError,
    );
  });

  it('accepts optional UTC timestamp and device metadata', () => {
    expect(
      parseCreateOrderInput({
        ...validInput,
        comandaNumber: null,
        deviceId: 'device-1',
        createdAt: '2026-11-02T18:30:00.000Z',
      }),
    ).toEqual({
      ...validInput,
      comandaNumber: null,
      deviceId: 'device-1',
      createdAt: '2026-11-02T18:30:00.000Z',
    });
  });

  it('rejects malformed or non-v7 IDs with safe field errors', () => {
    try {
      parseCreateOrderInput({ ...validInput, id: 'not-an-id' });
      throw new Error('expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiProblemError);
      expect(error).toMatchObject({
        status: 422,
        code: 'VALIDATION_FAILED',
        errors: [{ path: 'id', message: 'Identificador inválido.' }],
      });
    }
  });

  it('rejects a malformed optional table ID', () => {
    expect(() => parseCreateOrderInput({ id: validInput.id, tableId: 'not-an-id' })).toThrow(
      ApiProblemError,
    );
  });

  it('rejects invalid timestamp, wrong deviceId type, and unknown properties', () => {
    try {
      parseCreateOrderInput({
        ...validInput,
        deviceId: 7,
        createdAt: 'not-a-timestamp',
        restaurantId: 'client-controlled',
      });
      throw new Error('expected validation failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiProblemError);
      expect(error).toMatchObject({
        status: 422,
        errors: expect.arrayContaining([
          expect.objectContaining({ path: 'deviceId' }),
          expect.objectContaining({ path: 'createdAt' }),
          expect.objectContaining({ code: 'unrecognized_field' }),
        ]),
      });
    }
  });

  it('rejects a non-object request body', () => {
    expect(() => parseCreateOrderInput(null)).toThrow(ApiProblemError);
  });
});

describe('parseAddOrderItemInput', () => {
  it('accepts fractional quantities and normalizes blank notes', () => {
    expect(
      parseAddOrderItemInput({
        id: validInput.id,
        menuItemId: validInput.tableId,
        quantity: '1.250',
        notes: '  sem cebola  ',
      }),
    ).toEqual({
      id: validInput.id,
      menuItemId: validInput.tableId,
      quantity: '1.250',
      notes: 'sem cebola',
    });
    expect(
      parseAddOrderItemInput({
        id: validInput.id,
        menuItemId: validInput.tableId,
        quantity: '1',
        notes: '   ',
      }).notes,
    ).toBeNull();
  });

  it('accepts Brazilian decimal commas and canonicalizes quantity for persistence', () => {
    expect(
      parseAddOrderItemInput({
        id: validInput.id,
        menuItemId: validInput.tableId,
        quantity: '0,340',
      }).quantity,
    ).toBe('0.340');
  });

  it.each(['0', '-1', '1.0001', '1e2', '01'])('rejects invalid quantity %s', (quantity) => {
    expect(() =>
      parseAddOrderItemInput({
        id: validInput.id,
        menuItemId: validInput.tableId,
        quantity,
      }),
    ).toThrow(ApiProblemError);
  });

  it('rejects untrusted price fields and invalid item IDs', () => {
    expect(() =>
      parseAddOrderItemInput({
        id: validInput.id,
        menuItemId: 'not-an-id',
        quantity: '1',
        price: '0.01',
      }),
    ).toThrow(ApiProblemError);
  });
});

describe('pending order item mutation inputs', () => {
  it('accepts item edits with an expected version', () => {
    expect(
      parseUpdateOrderItemInput({
        expectedVersion: 3,
        quantity: '2.5',
        notes: '  sem gelo ',
      }),
    ).toEqual({
      expectedVersion: 3,
      quantity: '2.5',
      notes: 'sem gelo',
    });
  });

  it('requires a positive version for edit and removal', () => {
    expect(() => parseUpdateOrderItemInput({ expectedVersion: 0, quantity: '1' })).toThrow(
      ApiProblemError,
    );
    expect(() => parseDeleteOrderItemInput({ expectedVersion: -1 })).toThrow(ApiProblemError);
    expect(parseDeleteOrderItemInput({ expectedVersion: 1 })).toBe(1);
  });

  it('rejects price overrides and unknown mutation fields', () => {
    expect(() =>
      parseUpdateOrderItemInput({
        expectedVersion: 1,
        quantity: '1',
        price: '0.01',
      }),
    ).toThrow(ApiProblemError);
  });
});
