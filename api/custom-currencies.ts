import { Request, Response } from 'express';
import { createStorage } from './storage-factory';
import { logActivity } from './activity-logger';

export interface CustomCurrency {
  id: string;
  user_id: string;
  code: string;
  name: string;
  created_at: string;
}

export async function getCustomCurrencies(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const storage = await createStorage();
    const currencies = await storage.getCustomCurrenciesByUserId(userId);

    // Log activity
    await logActivity({
      userId,
      actionType: 'VIEW',
      resourceType: 'CUSTOM_CURRENCIES',
      description: 'Retrieved custom currencies list',
      metadata: {
        currencyCount: currencies.length,
        timestamp: new Date().toISOString()
      }
    });

    res.json(currencies);
  } catch (error) {
    console.error('Error fetching custom currencies:', error);
    res.status(500).json({ error: 'Failed to fetch custom currencies' });
  }
}

export async function createCustomCurrency(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { code, name } = req.body;
    
    if (!code || !name) {
      return res.status(400).json({ error: 'Currency code and name are required' });
    }

    // Validate code format (3-5 uppercase letters/numbers)
    if (!/^[A-Z0-9]{3,5}$/.test(code)) {
      return res.status(400).json({ 
        error: 'Currency code must be 3-5 uppercase letters or numbers' 
      });
    }

    const storage = await createStorage();
    
    // Check if currency already exists for this user
    const existingCurrencies = await storage.getCustomCurrenciesByUserId(userId);
    const existingCurrency = existingCurrencies.find((c: CustomCurrency) => c.code === code);
    
    if (existingCurrency) {
      return res.status(409).json({ error: 'Currency code already exists' });
    }

    const currency = await storage.createCustomCurrency({
      userId,
      code,
      name: name.trim(),
    });

    // Log activity
    await logActivity({
      userId,
      actionType: 'CREATE',
      resourceType: 'CUSTOM_CURRENCY',
      resourceId: currency.id,
      description: `Created custom currency: ${code} - ${name}`,
      metadata: {
        currencyCode: code,
        currencyName: name,
        timestamp: new Date().toISOString()
      }
    });

    res.status(201).json(currency);
  } catch (error) {
    console.error('Error creating custom currency:', error);
    res.status(500).json({ error: 'Failed to create custom currency' });
  }
}

export async function deleteCustomCurrency(req: Request, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { currencyCode } = req.params;
    
    if (!currencyCode) {
      return res.status(400).json({ error: 'Currency code is required' });
    }

    const storage = await createStorage();
    
    // Check if currency exists and belongs to user
    const existingCurrencies = await storage.getCustomCurrenciesByUserId(userId);
    const currency = existingCurrencies.find((c: CustomCurrency) => c.code === currencyCode);
    
    if (!currency) {
      return res.status(404).json({ error: 'Currency not found' });
    }

    await storage.deleteCustomCurrency(currencyCode, userId);

    // Log activity
    await logActivity({
      userId,
      actionType: 'DELETE',
      resourceType: 'CUSTOM_CURRENCY',
      resourceId: currency.id,
      description: `Deleted custom currency: ${currencyCode} - ${currency.name}`,
      metadata: {
        currencyCode,
        currencyName: currency.name,
        timestamp: new Date().toISOString()
      }
    });

    res.json({ message: 'Currency deleted successfully' });
  } catch (error) {
    console.error('Error deleting custom currency:', error);
    res.status(500).json({ error: 'Failed to delete custom currency' });
  }
}