import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../firebase'; // Adjust path if needed
import { Mail, Calendar, Trash2, Download } from 'lucide-react';

export default function AdminNewsletterPage() {
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSubscribers = async () => {
    setIsLoading(true);
    try {
      const querySnapshot = await getDocs(collection(db, 'newsletterSubscribers'));
      const fetched = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      fetched.sort((a: any, b: any) => new Date(b.subscribedAt).getTime() - new Date(a.subscribedAt).getTime());
      setSubscribers(fetched);
    } catch (error) {
      console.error("Error fetching subscribers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscribers();
  }, []);

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this subscriber?")) {
      try {
        await deleteDoc(doc(db, 'newsletterSubscribers', id));
        setSubscribers(subscribers.filter(sub => sub.id !== id));
      } catch (error) {
        console.error("Error deleting subscriber:", error);
        alert("Failed to delete subscriber.");
      }
    }
  };

  const handleExport = () => {
    if (subscribers.length === 0) {
      alert("No subscribers to export.");
      return;
    }
    const headers = ['Email Address', 'Date Subscribed', 'Status'];
    const csvRows = [headers.join(',')];

    subscribers.forEach(sub => {
      const row = [
        `"${sub.email || ''}"`,
        new Date(sub.subscribedAt).toLocaleDateString(),
        sub.status || 'active'
      ];
      csvRows.push(row.join(','));
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Laxardo_Subscribers_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-display uppercase tracking-tight">Newsletter List</h1>
          <p className="text-brand-secondary font-sans mt-1">Manage your email marketing audience</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 bg-brand-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors"
        >
          <Download size={16} />
          <span className="text-sm font-semibold uppercase tracking-wider">Export CSV</span>
        </button>
      </div>

      <div className="bg-white border border-brand-divider shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-brand-bg border-b border-brand-divider">
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Email Address</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Date Subscribed</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary">Status</th>
                <th className="p-6 text-[10px] uppercase tracking-widest font-bold text-brand-secondary text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-divider">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center">
                    <div className="inline-block w-8 h-8 border-4 border-brand-divider border-t-brand-black rounded-full animate-spin"></div>
                  </td>
                </tr>
              ) : subscribers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-20 text-center font-sans text-brand-secondary">
                    No subscribers found.
                  </td>
                </tr>
              ) : (
                subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="p-6">
                      <div className="flex items-center gap-3">
                        <Mail size={16} className="text-brand-secondary" />
                        <span className="font-medium text-brand-black">{sub.email}</span>
                      </div>
                    </td>
                    <td className="p-6">
                      <div className="flex items-center gap-2 text-brand-secondary text-sm">
                        <Calendar size={14} />
                        {sub.subscribedAt ? new Date(sub.subscribedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="p-6">
                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                        {sub.status || 'Active'}
                      </span>
                    </td>
                    <td className="p-6 text-right">
                       <button 
                         onClick={() => handleDelete(sub.id)}
                         className="text-red-500 hover:text-red-700 p-2 rounded-full hover:bg-red-50 transition-colors"
                         title="Remove Subscriber"
                       >
                         <Trash2 size={18} />
                       </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}