import React from 'react';
import { Link } from 'react-router-dom';

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  });
};

const parseBillItems = (bill) => {
  try {
    const items = typeof bill.items === 'string' ? JSON.parse(bill.items) : bill.items;
    return Array.isArray(items) ? items : [];
  } catch { return []; }
};

const BillRow = ({ bill, handleDelete, detailRoutePrefix = "/single", billType = "restaurant" }) => {
  const itemCount = parseBillItems(bill).length;
  return (
    <tr>
      <td className="col-checkbox">
        <input type="checkbox" />
      </td>
      {billType === 'metro' ? (
        <>
          <td className="col-invoice-number">
            <Link className="restaurant-link" to={`${detailRoutePrefix}/${bill.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {bill.invoice_number || '—'}
            </Link>
          </td>
          <td className="col-date">{formatDate(bill.invoice_date || bill.created_at)}</td>
          <td className="col-vendor">{bill.supplier_name || bill.vendor_name || '—'}</td>
          <td className="col-items">{itemCount} items</td>
          <td className="col-pan">{bill.pan_number || '—'}</td>
          <td className="col-state">{bill.state || '—'}</td>
        </>
      ) : (
        <>
          <td className="col-date">
            <span className="date-link">{formatDate(bill.created_at)}</span>
          </td>
          <td className="col-restaurant">
            <Link className="restaurant-link" to={`${detailRoutePrefix}/${bill.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              {bill.restaurant_name || bill.vendor_name || bill.supplier_name || '—'}
            </Link>
          </td>
          <td className="col-items">{itemCount} items</td>
          <td className="col-sgst">₹{parseFloat(bill.sgst || 0).toFixed(2)}</td>
          <td className="col-cgst">₹{parseFloat(bill.cgst || 0).toFixed(2)}</td>
          <td className="col-total">
            <span className="total-badge">₹{parseFloat(bill.grand_total || bill.grandTotal || 0).toFixed(2)}</span>
          </td>
          <td className="col-created">{formatDateTime(bill.created_at)}</td>
        </>
      )}
      <td className="col-status">
        <span className="status-badge status-processed">Processed</span>
      </td>
      <td className="col-action">
        <button className="action-menu-btn" onClick={() => handleDelete(bill.id)} title="Delete bill">🗑️</button>
      </td>
    </tr>
  );
};

export default BillRow;










