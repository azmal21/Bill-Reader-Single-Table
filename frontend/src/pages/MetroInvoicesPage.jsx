import React from 'react';
import BillList from '../components/bills/BillList';

const MetroInvoicesPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="Metro Invoices" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
      detailRoutePrefix="/metro/single"
    />
  );
};

export default MetroInvoicesPage;
