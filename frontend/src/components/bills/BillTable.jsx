import React from 'react';
import BillRow from './BillRow';

const BillTable = ({ bills, handleDelete, detailRoutePrefix }) => {
  return (
    <table className="bills-table" id="bills-table">
      <thead>
        <tr>
          <th className="col-checkbox"><input type="checkbox" disabled /></th>
          <th className="col-date sortable">Date <span className="sort-arrow">▼</span></th>
          <th className="col-restaurant sortable">Restaurant <span className="sort-arrow">▼</span></th>
          <th className="col-items sortable">Items <span className="sort-arrow">▼</span></th>
          <th className="col-sgst sortable">SGST <span className="sort-arrow">▼</span></th>
          <th className="col-cgst sortable">CGST <span className="sort-arrow">▼</span></th>
          <th className="col-total sortable">Grand Total <span className="sort-arrow">▼</span></th>
          <th className="col-created sortable">Created At <span className="sort-arrow">▼</span></th>
          <th className="col-status">Status</th>
          <th className="col-action">Action</th>
        </tr>
      </thead>
      <tbody>
        {bills.map(bill => <BillRow key={bill.id} bill={bill} handleDelete={handleDelete} detailRoutePrefix={detailRoutePrefix} />)}
      </tbody>
    </table>
  );
};

export default BillTable;
