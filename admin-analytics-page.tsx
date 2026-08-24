'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface ProductAnalytics {
  id: string;
  name: string;
  views: number;
  clicks: number;
  price: number;
  conversion_rate: number;
}

export default function AdminAnalytics() {
  const [topProducts, setTopProducts] = useState<ProductAnalytics[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchAnalytics();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    return () => clearInterval(interval);
  }, []);

  async function fetchAnalytics() {
    try {
      setLoading(true);

      // Get top products by views
      const { data: products, error } = await supabase
        .from('products')
        .select('id, name, views, clicks, price')
        .order('views', { ascending: false })
        .limit(10);

      if (error) throw error;

      // Calculate metrics
      const total_views = products?.reduce((sum, p) => sum + (p.views || 0), 0) || 0;
      const total_clicks = products?.reduce((sum, p) => sum + (p.clicks || 0), 0) || 0;

      // Format data for chart
      const formatted = products?.map((p) => ({
        id: p.id,
        name: p.name.substring(0, 15) + '...',
        views: p.views || 0,
        clicks: p.clicks || 0,
        conversion_rate: p.clicks && p.views ? ((p.clicks / p.views) * 100).toFixed(2) : 0,
      })) || [];

      setTopProducts(formatted);
      setTotalViews(total_views);
      setTotalClicks(total_clicks);
      setChartData(formatted);
    } catch (error) {
      console.error('Analytics error:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">📊 Product Analytics</h1>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-semibold">TOTAL VIEWS</div>
            <div className="text-4xl font-bold text-burgundy mt-2">{totalViews.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-2">All product views tracked</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-semibold">TOTAL CLICKS</div>
            <div className="text-4xl font-bold text-green-600 mt-2">{totalClicks.toLocaleString()}</div>
            <div className="text-xs text-gray-500 mt-2">Product clicks/purchases</div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="text-gray-600 text-sm font-semibold">CONVERSION RATE</div>
            <div className="text-4xl font-bold text-blue-600 mt-2">
              {totalViews > 0 ? ((totalClicks / totalViews) * 100).toFixed(2) : 0}%
            </div>
            <div className="text-xs text-gray-500 mt-2">Views to clicks ratio</div>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Views Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">👁️ Top Products by Views</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="views" fill="#8b1a1a" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No data yet</p>
            )}
          </div>

          {/* Clicks Chart */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">🔗 Top Products by Clicks</h2>
            {chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="clicks" fill="#22c55e" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-gray-500">No data yet</p>
            )}
          </div>
        </div>

        {/* Detailed Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold text-gray-900">📋 Detailed Analytics</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Clicks</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Conversion Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {topProducts.map((product, idx) => (
                  <tr key={product.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">#{idx + 1}</span>
                        <span className="text-sm text-gray-700">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-900">{product.views}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-green-600">{product.clicks}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-blue-600">{product.conversion_rate}%</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs font-semibold px-3 py-1 rounded-full ${
                        product.views > 50 ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {product.views > 50 ? '🔥 Trending' : 'New'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refresh button */}
        <div className="mt-8 flex justify-center">
          <button
            onClick={fetchAnalytics}
            disabled={loading}
            className="bg-burgundy text-white px-6 py-2 rounded-full hover:bg-opacity-90 disabled:opacity-50 transition"
          >
            {loading ? 'Refreshing...' : 'Refresh Analytics'}
          </button>
        </div>
      </div>
    </div>
  );
}
