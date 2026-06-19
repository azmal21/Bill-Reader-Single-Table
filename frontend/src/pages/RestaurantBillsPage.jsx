import React from 'react';
import BillList from '../components/bills/BillList';

const RestaurantBillsPage = ({ bills, billsLoading, billsError, handleDelete, openUploadModal }) => {
  return (
    <BillList 
      title="Restaurant Bills" 
      bills={bills} 
      billsLoading={billsLoading} 
      billsError={billsError} 
      handleDelete={handleDelete} 
      onImportClick={openUploadModal} 
      totalBills={bills.length}
      billType="restaurant"
    />
  );
};

export default RestaurantBillsPage;
