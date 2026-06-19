import React from 'react';
import BillList from '../components/bills/BillList';

const GSTInvoicesPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="GST Invoices" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
      billType="gst"
    />
  );
};

export default GSTInvoicesPage;
