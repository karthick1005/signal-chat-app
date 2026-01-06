/**
 * WhatsApp Signal Group Service Instance
 * Singleton instance for the new WhatsApp Signal Protocol Group Service
 */

import WhatsAppSignalGroupService from './signal/WhatsAppSignalGroupService';

let whatsappSignalGroupServiceInstance: WhatsAppSignalGroupService | null = null;

export const getWhatsAppSignalGroupService = (): WhatsAppSignalGroupService | null => {
  return whatsappSignalGroupServiceInstance;
};

export const initializeWhatsAppSignalGroupService = (socket: any): WhatsAppSignalGroupService => {
  if (!whatsappSignalGroupServiceInstance) {
    whatsappSignalGroupServiceInstance = new WhatsAppSignalGroupService(socket);
  } else {
    // Update socket if needed
    whatsappSignalGroupServiceInstance = new WhatsAppSignalGroupService(socket);
  }
  return whatsappSignalGroupServiceInstance;
};

export const whatsappSignalGroupService = {
  getInstance: getWhatsAppSignalGroupService,
  initialize: initializeWhatsAppSignalGroupService
};
